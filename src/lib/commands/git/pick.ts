import type { JSRuntimeFS } from '../../JSRuntime';
import type { ShellCommandResult } from '../ShellCommand';
import { createErrorResult } from '../ShellCommand';
import type { Git } from '../../git';
import { parseArgs, unknownOption } from './args';
import { compareSnapshots, countLines, formatSummary, indexSnapshot, readVersion, treeSnapshot } from './diffing';
import { parseRange, walkCommits } from './history';
import { abbrev, resolveCommit, RevisionError } from './revisions';
import { clearSequencerState, readMergeMessage, readSequencerHead, saveSequencerState, type SequencerOperation } from './sequencer';
import { applyThreeWay } from './threeWay';

interface PickOptions {
  noCommit: boolean;
  appendOrigin: boolean;
  signoff: boolean;
  mainline?: number;
  quiet: boolean;
}

/**
 * `git cherry-pick` and `git revert`: apply (or undo) the changes of one or
 * more commits on top of HEAD, stopping on conflicts so they can be resolved
 * and the operation resumed with `--continue`.
 */
export class Picker {
  constructor(
    private git: Git,
    private fs: JSRuntimeFS,
    private operation: SequencerOperation,
    private usage: string,
  ) {}

  async execute(args: string[], dir: string): Promise<ShellCommandResult> {
    try {
      await this.fs.stat(`${dir}/.git`);
    } catch {
      return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
    }

    const parsed = parseArgs(args, {
      flags: {
        n: 'noCommit', 'no-commit': 'noCommit', e: 'edit', edit: 'edit', x: 'appendOrigin',
        s: 'signoff', signoff: 'signoff', 'no-edit': 'noEdit', 'allow-empty': 'allowEmpty',
        'keep-redundant-commits': 'allowEmpty', ff: 'ff', q: 'quiet', quiet: 'quiet',
        continue: 'continue', abort: 'abort', skip: 'skip', quit: 'quit',
      },
      values: { m: 'mainline', mainline: 'mainline', 'strategy': 'strategy', X: 'strategyOption', 'strategy-option': 'strategyOption' },
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage));

    const options: PickOptions = {
      noCommit: parsed.has('noCommit'),
      appendOrigin: parsed.has('appendOrigin'),
      signoff: parsed.has('signoff'),
      mainline: parsed.get('mainline') !== undefined ? parseInt(parsed.get('mainline')!, 10) : undefined,
      quiet: parsed.has('quiet'),
    };

    try {
      if (parsed.has('abort')) return await this.abort(dir);
      if (parsed.has('quit')) {
        await this.clearTodo(dir);
        await clearSequencerState(this.fs, dir);
        return { exitCode: 0, stdout: '', stderr: '' };
      }
      if (parsed.has('continue')) return await this.resume(dir, options, false);
      if (parsed.has('skip')) return await this.resume(dir, options, true);

      if (await readSequencerHead(this.fs, dir, this.operation)) {
        return createErrorResult(`error: ${this.operation} is already in progress\nhint: try "git ${this.operation} (--continue | --abort | --quit)"\nfatal: ${this.operation} failed`);
      }
      if (parsed.positionals.length === 0) {
        return createErrorResult(`usage: ${this.usage}`);
      }

      const commits = await this.listCommits(dir, parsed.positionals);
      if (commits.length === 0) return createErrorResult('error: empty commit set passed');

      try {
        await this.fs.mkdir(`${dir}/.git/sequencer`, { recursive: true });
        await this.fs.writeFile(`${dir}/.git/sequencer/head`, `${await this.git.resolveRef({ dir, ref: 'HEAD' })}\n`);
      } catch {
        return createErrorResult(`fatal: bad revision 'HEAD'`);
      }
      return await this.run(dir, commits, options, '');
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message);
      return createErrorResult(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /** The commits to apply, in application order. */
  private async listCommits(dir: string, specs: string[]): Promise<string[]> {
    const commits: string[] = [];
    for (const spec of specs) {
      if (spec.includes('..')) {
        const range = await parseRange(this.git, dir, [spec]);
        const listed: string[] = [];
        for await (const entry of walkCommits(this.git, dir, range)) listed.push(entry.oid);
        // Cherry-pick replays oldest first; revert undoes newest first.
        commits.push(...(this.operation === 'cherry-pick' ? listed.reverse() : listed));
      } else {
        commits.push(await resolveCommit(this.git, dir, spec));
      }
    }
    return commits;
  }

  private async run(dir: string, commits: string[], options: PickOptions, output: string): Promise<ShellCommandResult> {
    let out = output;
    for (let i = 0; i < commits.length; i++) {
      const oid = commits[i];
      const result = await this.pickOne(dir, oid, options);
      out += result.stdout;
      if (result.exitCode !== 0) {
        await this.writeTodo(dir, commits.slice(i + 1));
        return { exitCode: result.exitCode, stdout: out, stderr: result.stderr };
      }
    }
    await this.clearTodo(dir);
    return { exitCode: 0, stdout: out, stderr: '' };
  }

  private async pickOne(dir: string, oid: string, options: PickOptions): Promise<ShellCommandResult> {
    const { commit } = await this.git.readCommit({ dir, oid });
    const subject = commit.message.trim().split('\n')[0];
    const short = abbrev(oid);

    let parentOid: string | undefined;
    if (commit.parent.length > 1) {
      if (!options.mainline) {
        return createErrorResult(`error: commit ${oid} is a merge but no -m option was given.\nfatal: ${this.operation} failed`);
      }
      parentOid = commit.parent[options.mainline - 1];
      if (!parentOid) return createErrorResult(`error: commit ${oid} does not have parent ${options.mainline}\nfatal: ${this.operation} failed`);
    } else {
      if (options.mainline) {
        return createErrorResult(`error: mainline was specified but commit ${oid} is not a merge.\nfatal: ${this.operation} failed`);
      }
      parentOid = commit.parent[0];
    }
    if (!parentOid && this.operation === 'revert') {
      // Reverting a root commit removes everything it added.
      parentOid = undefined;
    }

    const parentTree = parentOid ? (await this.git.readCommit({ dir, oid: parentOid })).commit.tree : null;
    const commitTree = await treeSnapshot(this.git, dir, commit.tree);
    const parentSnapshot = await treeSnapshot(this.git, dir, parentTree);

    const headOid = await this.git.resolveRef({ dir, ref: 'HEAD' });
    const headCommit = (await this.git.readCommit({ dir, oid: headOid })).commit;
    const ours = await treeSnapshot(this.git, dir, headCommit.tree);

    const reverting = this.operation === 'revert';
    let message = reverting
      ? `Revert "${subject}"\n\nThis reverts commit ${oid}.\n`
      : commit.message;
    if (options.appendOrigin && !reverting) message = `${message.replace(/\n+$/, '')}\n\n(cherry picked from commit ${oid})\n`;
    if (options.signoff) {
      const name = await this.git.getConfig({ dir, path: 'user.name' });
      const email = await this.git.getConfig({ dir, path: 'user.email' });
      if (name && email) message = `${message.replace(/\n+$/, '')}\n\nSigned-off-by: ${name} <${email}>\n`;
    }

    const result = await applyThreeWay(this.git, this.fs, dir, {
      base: reverting ? commitTree : parentSnapshot,
      theirs: reverting ? parentSnapshot : commitTree,
      ours,
      ourLabel: 'HEAD',
      theirLabel: reverting ? `parent of ${short} (${subject})` : `${short} (${subject})`,
    }, this.operation);

    if (result.conflicted.length > 0) {
      await saveSequencerState(this.fs, dir, this.operation, oid, message);
      const hint = options.noCommit
        ? ''
        : `hint: After resolving the conflicts, mark them with\nhint: "git add/rm <pathspec>", then run\nhint: "git ${this.operation} --continue".\nhint: You can instead skip this commit with "git ${this.operation} --skip".\nhint: To abort and get back to the state before "git ${this.operation}",\nhint: run "git ${this.operation} --abort".\n`;
      return {
        exitCode: 1,
        stdout: result.conflicted.map((p) => `Auto-merging ${p}\n`).join('') + result.conflicts.map((c) => `${c}\n`).join(''),
        stderr: `error: could not ${reverting ? 'revert' : 'apply'} ${short}... ${subject}\n${hint}`,
      };
    }

    if (options.noCommit) {
      await this.clearTodo(dir);
      return { exitCode: 0, stdout: '', stderr: '' };
    }

    return this.commit(dir, message, reverting ? undefined : commit.author, options.quiet);
  }

  private async commit(dir: string, message: string, author: { name: string; email: string; timestamp: number; timezoneOffset: number } | undefined, quiet: boolean): Promise<ShellCommandResult> {
    const headOid = await this.git.resolveRef({ dir, ref: 'HEAD' });
    const headTree = (await this.git.readCommit({ dir, oid: headOid })).commit.tree;
    const changes = compareSnapshots(await treeSnapshot(this.git, dir, headTree), await indexSnapshot(this.git, dir));
    if (changes.length === 0) {
      return createErrorResult(
        `On branch ${(await this.git.currentBranch({ dir })) ?? 'HEAD'}\nnothing to commit, working tree clean\n` +
        `The previous ${this.operation} is now empty, possibly due to conflict resolution.\n` +
        `If you wish to commit it anyway, use:\n\n    git commit --allow-empty\n\nOtherwise, please use 'git ${this.operation} --skip'`,
      );
    }

    const oid = await this.git.commit({ dir, message, ...(author ? { author } : {}) });
    await clearSequencerState(this.fs, dir);
    if (quiet) return { exitCode: 0, stdout: '', stderr: '' };

    let added = 0;
    let removed = 0;
    for (const change of changes) {
      const counts = countLines(await readVersion(this.git, dir, change.old), await readVersion(this.git, dir, change.new));
      added += counts?.added ?? 0;
      removed += counts?.removed ?? 0;
    }
    const branch = (await this.git.currentBranch({ dir })) ?? 'detached HEAD';
    let out = `[${branch} ${abbrev(oid)}] ${message.trim().split('\n')[0]}\n${formatSummary(changes.length, added, removed)}\n`;
    for (const change of changes) {
      if (change.status === 'A') out += ` create mode ${change.new!.mode} ${change.path}\n`;
      else if (change.status === 'D') out += ` delete mode ${change.old!.mode} ${change.path}\n`;
    }
    return { exitCode: 0, stdout: out, stderr: '' };
  }

  private async resume(dir: string, options: PickOptions, skip: boolean): Promise<ShellCommandResult> {
    const current = await readSequencerHead(this.fs, dir, this.operation);
    const todo = await this.readTodo(dir);
    if (!current && todo === undefined) {
      return createErrorResult(`error: no ${this.operation} in progress\nfatal: ${this.operation} failed`);
    }

    let out = '';
    if (current) {
      if (skip) {
        await this.resetHard(dir, await this.git.resolveRef({ dir, ref: 'HEAD' }));
        await clearSequencerState(this.fs, dir);
      } else {
        const message = (await readMergeMessage(this.fs, dir)) ?? '';
        const { commit } = await this.git.readCommit({ dir, oid: current });
        const result = await this.commit(dir, message, this.operation === 'cherry-pick' ? commit.author : undefined, options.quiet);
        if (result.exitCode !== 0) return result;
        out += result.stdout;
      }
    }
    return this.run(dir, todo ?? [], options, out);
  }

  private async abort(dir: string): Promise<ShellCommandResult> {
    let head: string;
    try {
      head = (await this.fs.readFile(`${dir}/.git/sequencer/head`, 'utf8')).trim();
    } catch {
      if (!(await readSequencerHead(this.fs, dir, this.operation))) {
        return createErrorResult(`error: no ${this.operation} in progress\nfatal: ${this.operation} failed`);
      }
      head = await this.git.resolveRef({ dir, ref: 'HEAD' });
    }
    await this.resetHard(dir, head);
    await clearSequencerState(this.fs, dir);
    await this.clearTodo(dir);
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  /** Point the current branch (or HEAD) at `oid` and make the index and work tree match it. */
  private async resetHard(dir: string, oid: string): Promise<void> {
    const branch = await this.git.currentBranch({ dir });
    if (branch) {
      await this.git.writeRef({ dir, ref: `refs/heads/${branch}`, value: oid, force: true });
      await this.git.checkout({ dir, ref: branch, force: true });
    } else {
      await this.git.checkout({ dir, ref: oid, force: true });
    }
  }

  private async writeTodo(dir: string, commits: string[]): Promise<void> {
    await this.fs.mkdir(`${dir}/.git/sequencer`, { recursive: true });
    await this.fs.writeFile(`${dir}/.git/sequencer/todo`, commits.map((c) => `${c}\n`).join(''));
  }

  private async readTodo(dir: string): Promise<string[] | undefined> {
    try {
      return (await this.fs.readFile(`${dir}/.git/sequencer/todo`, 'utf8')).split('\n').filter(Boolean);
    } catch {
      return undefined;
    }
  }

  private async clearTodo(dir: string): Promise<void> {
    for (const name of ['todo', 'head']) {
      try {
        await this.fs.unlink(`${dir}/.git/sequencer/${name}`);
      } catch {
        // Not there.
      }
    }
    try {
      await this.fs.rmdir(`${dir}/.git/sequencer`);
    } catch {
      // Not there.
    }
  }
}
