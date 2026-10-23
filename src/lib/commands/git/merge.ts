import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { compareSnapshots, defaultDiffFormat, formatChanges, indexSnapshot, treeSnapshot, type FileChange, type Snapshot } from "./diffing";
import { abbrev, resolveCommit } from "./revisions";
import { applyThreeWay, dirtyPaths, writeVersion } from "./threeWay";
import { clearSequencerState } from "./sequencer";
import { formatDate } from "./pretty";
import { ancestors, isAncestor } from "./refUtils";
import { GitCommitCommand } from "./commit";

interface MergeOptions {
  quiet: boolean;
  stat: boolean;
  squash: boolean;
  commit: boolean;
  message?: string;
}

/** `git merge`: fast-forward, or a three-way merge that stops with conflict markers. */
export class GitMergeCommand implements GitSubcommand {
  name = 'merge';
  description = 'Join two or more development histories together';
  usage = 'git merge [-n] [--stat] [--no-commit] [--squash] [--[no-]edit] [--ff | --no-ff | --ff-only] [-m <msg>] [-F <file>] [--allow-unrelated-histories] [<commit>...]\n   or: git merge --abort\n   or: git merge --continue';

  private git: Git;
  private fs: JSRuntimeFS;
  private options: GitSubcommandOptions;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
    this.options = options;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git', 128);
      }

      const parsed = parseArgs(args, {
        flags: {
          ff: 'ff', 'ff-only': 'ffOnly', abort: 'abort', continue: 'continue', quit: 'quit',
          squash: 'squash', commit: 'commit', edit: 'edit', e: 'edit', q: 'quiet', quiet: 'quiet',
          v: 'verbose', verbose: 'verbose', stat: 'stat', summary: 'stat', n: 'noStat', log: 'log',
          'allow-unrelated-histories': 'allowUnrelated', progress: 'progress', verify: 'verify',
          'verify-signatures': 'verifySignatures', signoff: 'signoff', autostash: 'autostash', 'rerere-autoupdate': 'rerere',
        },
        values: { m: 'message', message: 'message', F: 'file', file: 'file', s: 'strategy', strategy: 'strategy', X: 'strategyOption', 'strategy-option': 'strategyOption', cleanup: 'cleanup', 'into-name': 'intoName' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }

      const mergeHeadPath = `${cwd}/.git/MERGE_HEAD`;
      const mergeHead = await this.readFile(mergeHeadPath);

      if (parsed.has('abort')) {
        if (!mergeHead) return createErrorResult('fatal: There is no merge to abort (MERGE_HEAD missing).', 128);
        await this.abort(cwd);
        return createSuccessResult('');
      }
      if (parsed.has('quit')) {
        await clearSequencerState(this.fs, cwd);
        return createSuccessResult('');
      }
      if (parsed.has('continue')) {
        if (!mergeHead) return createErrorResult('fatal: There is no merge in progress (MERGE_HEAD missing).', 128);
        return await new GitCommitCommand(this.options).execute(['--no-edit'], cwd);
      }
      if (mergeHead) {
        return createErrorResult('fatal: You have not concluded your merge (MERGE_HEAD exists).\nhint: Please, commit your changes before merging.', 128);
      }

      const strategy = parsed.get('strategy');
      if (strategy && !['ort', 'recursive', 'resolve'].includes(strategy)) {
        return createErrorResult(`Could not find merge strategy '${strategy}'.\nAvailable strategies are: ort recursive resolve.`, 1);
      }

      let message = parsed.getAll('message').join('\n\n') || undefined;
      for (const file of parsed.getAll('file')) {
        const text = await this.readFile(file.startsWith('/') ? file : `${cwd}/${file}`);
        if (text === undefined) return createErrorResult(`error: could not read file '${file}'`, 128);
        message = [message, text.replace(/\n+$/, '')].filter(Boolean).join('\n\n');
      }

      let specs = parsed.rest;
      if (specs.length === 0) {
        const upstream = await this.upstream(cwd);
        if (!upstream) return createErrorResult('fatal: No remote for the current branch.', 128);
        specs = [upstream];
      }
      if (specs.length > 1) {
        return createErrorResult('fatal: octopus merges (more than one commit) are not supported here; merge one at a time', 128);
      }
      const spec = specs[0];

      let theirs: string;
      try {
        theirs = await resolveCommit(this.git, cwd, spec);
      } catch {
        return createErrorResult(`merge: ${spec} - not something we can merge`, 1);
      }

      const options: MergeOptions = {
        quiet: parsed.has('quiet'),
        stat: !parsed.has('noStat') && !parsed.negated('stat') && !parsed.has('quiet'),
        squash: parsed.has('squash'),
        commit: !parsed.negated('commit'),
        message,
      };
      const ffOnly = parsed.has('ffOnly');
      const noFf = parsed.negated('ff');
      if (options.squash && noFf) return createErrorResult('fatal: options \'--squash\' and \'--no-ff.\' cannot be used together', 128);

      const branch = await this.currentBranch(cwd);
      let head: string | undefined;
      try {
        head = await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
      } catch {
        head = undefined;
      }

      // Merging into an unborn branch just points it at the commit.
      if (!head) {
        const target = await this.commitSnapshot(cwd, theirs);
        await this.checkoutChanges(cwd, compareSnapshots(new Map(), target), target);
        await this.updateHead(cwd, branch, theirs);
        return createSuccessResult('');
      }

      if (head === theirs || await isAncestor(this.git, cwd, theirs, head)) {
        return createSuccessResult(options.quiet ? '' : 'Already up to date.\n');
      }

      const headSnapshot = await this.commitSnapshot(cwd, head);
      const theirSnapshot = await this.commitSnapshot(cwd, theirs);

      const canFastForward = await isAncestor(this.git, cwd, head, theirs);
      if (canFastForward && !noFf) {
        const changes = compareSnapshots(headSnapshot, theirSnapshot);
        const blocked = await this.blockedPaths(cwd, headSnapshot, changes);
        if (blocked) return blocked;

        await this.writeFile(`${cwd}/.git/ORIG_HEAD`, `${head}\n`);
        await this.checkoutChanges(cwd, changes, theirSnapshot);

        let out = options.quiet ? '' : `Updating ${abbrev(head)}..${abbrev(theirs)}\nFast-forward\n`;
        if (options.squash) {
          await this.writeFile(`${cwd}/.git/MERGE_MSG`, await this.squashMessage(cwd, head, theirs));
          if (!options.quiet) out += 'Squash commit -- not updating HEAD\n';
        } else {
          await this.updateHead(cwd, branch, theirs);
        }
        if (options.stat) out += await this.stat(cwd, changes);
        return createSuccessResult(out);
      }

      if (ffOnly) {
        return createErrorResult('hint: Diverging branches can\'t be fast-forwarded, you need to either:\nhint:\nhint: \tgit merge --no-ff\nhint:\nhint: or:\nhint:\nhint: \tgit rebase\nhint:\nfatal: Not possible to fast-forward, aborting.', 128);
      }

      // Three-way merge against the merge base.
      const bases = await this.git.findMergeBase({ dir: cwd, oids: [head, theirs] }) as string[];
      let baseSnapshot: Snapshot;
      if (bases.length === 0) {
        if (!parsed.has('allowUnrelated')) return createErrorResult('fatal: refusing to merge unrelated histories', 128);
        baseSnapshot = new Map();
      } else {
        baseSnapshot = await this.commitSnapshot(cwd, bases[0]);
      }

      const incoming = compareSnapshots(baseSnapshot, theirSnapshot);
      const blocked = await this.blockedPaths(cwd, headSnapshot, incoming);
      if (blocked) return blocked;

      await this.writeFile(`${cwd}/.git/ORIG_HEAD`, `${head}\n`);
      const result = await applyThreeWay(this.git, this.fs, cwd, {
        base: baseSnapshot,
        theirs: theirSnapshot,
        ours: headSnapshot,
        ourLabel: 'HEAD',
        theirLabel: spec,
      }, 'merge');

      // "Auto-merging" for files changed on both sides, in path order with their conflicts.
      const ourChanges = new Set(compareSnapshots(baseSnapshot, headSnapshot).map((c) => c.path));
      let out = options.squash && !options.quiet ? 'Squash commit -- not updating HEAD\n' : '';
      const reported = new Set<string>();
      for (const change of incoming) {
        const both = ourChanges.has(change.path) && headSnapshot.get(change.path)?.oid !== theirSnapshot.get(change.path)?.oid;
        if (both && headSnapshot.has(change.path) && theirSnapshot.has(change.path) && !options.quiet) {
          out += `Auto-merging ${change.path}\n`;
        }
        for (const conflict of result.conflicts) {
          if (!reported.has(conflict) && (conflict.endsWith(` ${change.path}`) || conflict.includes(`: ${change.path} `))) {
            out += `${conflict}\n`;
            reported.add(conflict);
          }
        }
      }
      for (const conflict of result.conflicts) if (!reported.has(conflict)) out += `${conflict}\n`;

      const defaultMessage = await this.defaultMessage(cwd, spec, branch);
      const mergeMessage = (options.message ?? defaultMessage).replace(/\n*$/, '\n');

      if (result.conflicted.length > 0) {
        if (options.squash) {
          await this.writeFile(`${cwd}/.git/MERGE_MSG`, await this.squashMessage(cwd, head, theirs));
        } else {
          await this.writeFile(mergeHeadPath, `${theirs}\n`);
          await this.writeFile(`${cwd}/.git/MERGE_MODE`, noFf ? 'no-ff' : '');
          const conflicts = `\n# Conflicts:\n${result.conflicted.map((p) => `#\t${p}\n`).join('')}`;
          await this.writeFile(`${cwd}/.git/MERGE_MSG`, `${mergeMessage}${conflicts}`);
        }
        out += 'Automatic merge failed; fix conflicts and then commit the result.\n';
        return { exitCode: 1, stdout: out, stderr: '' };
      }

      if (options.squash || !options.commit) {
        if (options.squash) {
          await this.writeFile(`${cwd}/.git/MERGE_MSG`, await this.squashMessage(cwd, head, theirs));
        } else {
          await this.writeFile(mergeHeadPath, `${theirs}\n`);
          await this.writeFile(`${cwd}/.git/MERGE_MODE`, noFf ? 'no-ff' : '');
          await this.writeFile(`${cwd}/.git/MERGE_MSG`, mergeMessage);
        }
        if (!options.quiet) out += 'Automatic merge went well; stopped before committing as requested\n';
        return createSuccessResult(out);
      }

      await this.git.commit({ dir: cwd, message: mergeMessage, parent: [head, theirs] });
      await clearSequencerState(this.fs, cwd);

      if (!options.quiet) out += 'Merge made by the \'ort\' strategy.\n';
      if (options.stat) {
        const merged = await this.commitSnapshot(cwd, await this.git.resolveRef({ dir: cwd, ref: 'HEAD' }));
        out += await this.stat(cwd, compareSnapshots(headSnapshot, merged));
      }
      return createSuccessResult(out);
    } catch (error) {
      return createErrorResult(`git merge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async currentBranch(cwd: string): Promise<string | undefined> {
    try {
      return (await this.git.currentBranch({ dir: cwd })) || undefined;
    } catch {
      return undefined;
    }
  }

  private async upstream(cwd: string): Promise<string | undefined> {
    const branch = await this.currentBranch(cwd);
    if (!branch) return undefined;
    const remote = await this.git.getConfig({ dir: cwd, path: `branch.${branch}.remote` }) as string | undefined;
    const merge = await this.git.getConfig({ dir: cwd, path: `branch.${branch}.merge` }) as string | undefined;
    if (!remote || !merge) return undefined;
    const name = merge.replace(/^refs\/heads\//, '');
    return remote === '.' ? name : `${remote}/${name}`;
  }

  private async commitSnapshot(cwd: string, oid: string): Promise<Snapshot> {
    const { commit } = await this.git.readCommit({ dir: cwd, oid });
    return treeSnapshot(this.git, cwd, commit.tree);
  }

  /** git's refusal when the merge would overwrite local changes or untracked files, or undefined. */
  private async blockedPaths(cwd: string, ours: Snapshot, changes: FileChange[]): Promise<ShellCommandResult | undefined> {
    const dirty = await dirtyPaths(this.git, this.fs, cwd, ours);
    const local = changes.map((c) => c.path).filter((p) => dirty.has(p));
    if (local.length > 0) {
      return createErrorResult(
        'error: Your local changes to the following files would be overwritten by merge:\n' +
        local.map((p) => `\t${p}\n`).join('') +
        'Please commit your changes or stash them before you merge.\nAborting',
        1,
      );
    }
    const index = await indexSnapshot(this.git, cwd);
    const untracked: string[] = [];
    for (const change of changes) {
      if (!change.new || ours.has(change.path) || index.has(change.path)) continue;
      if (await this.exists(`${cwd}/${change.path}`)) untracked.push(change.path);
    }
    if (untracked.length > 0) {
      return createErrorResult(
        'error: The following untracked working tree files would be overwritten by merge:\n' +
        untracked.map((p) => `\t${p}\n`).join('') +
        'Please move or remove them before you merge.\nAborting',
        1,
      );
    }
    return undefined;
  }

  private async checkoutChanges(cwd: string, changes: FileChange[], target: Snapshot): Promise<void> {
    for (const change of changes) {
      await writeVersion(this.git, this.fs, cwd, change.path, target.get(change.path));
      if (!target.has(change.path)) await this.pruneEmptyDirs(cwd, change.path);
    }
  }

  private async pruneEmptyDirs(cwd: string, path: string): Promise<void> {
    const parts = path.split('/').slice(0, -1);
    while (parts.length > 0) {
      try {
        const dir = `${cwd}/${parts.join('/')}`;
        if ((await this.fs.readdir(dir)).length > 0) return;
        await this.fs.rmdir(dir);
      } catch {
        return;
      }
      parts.pop();
    }
  }

  private async updateHead(cwd: string, branch: string | undefined, oid: string): Promise<void> {
    if (branch) {
      await this.git.writeRef({ dir: cwd, ref: `refs/heads/${branch}`, value: oid, force: true });
    } else {
      await this.git.writeRef({ dir: cwd, ref: 'HEAD', value: oid, force: true });
    }
  }

  private async stat(cwd: string, changes: FileChange[]): Promise<string> {
    if (changes.length === 0) return '';
    let out = await formatChanges(this.git, cwd, changes, { ...defaultDiffFormat(), patch: false, stat: true });
    for (const change of changes) {
      if (change.status === 'A') out += ` create mode ${change.new!.mode} ${change.path}\n`;
      else if (change.status === 'D') out += ` delete mode ${change.old!.mode} ${change.path}\n`;
    }
    return out;
  }

  private async defaultMessage(cwd: string, spec: string, branch: string | undefined): Promise<string> {
    const into = branch && branch !== 'main' && branch !== 'master' ? ` into ${branch}` : '';
    const refExists = async (ref: string) => {
      try {
        await this.git.resolveRef({ dir: cwd, ref });
        return true;
      } catch {
        return false;
      }
    };
    if (await refExists(`refs/heads/${spec}`)) return `Merge branch '${spec}'${into}`;
    if (await refExists(`refs/tags/${spec}`)) return `Merge tag '${spec}'${into}`;
    if (await refExists(`refs/remotes/${spec}`)) return `Merge remote-tracking branch '${spec}'${into}`;
    return `Merge commit '${spec}'${into}`;
  }

  private async squashMessage(cwd: string, head: string, theirs: string): Promise<string> {
    const exclude = await ancestors(this.git, cwd, head);
    const commits = (await this.git.log({ dir: cwd, ref: theirs })).filter((c) => !exclude.has(c.oid));
    let out = 'Squashed commit of the following:\n';
    for (const { oid, commit } of commits) {
      out += `\ncommit ${oid}\nAuthor: ${commit.author.name} <${commit.author.email}>\nDate:   ${formatDate(commit.author)}\n\n`;
      out += commit.message.replace(/\n+$/, '').split('\n').map((l) => (l ? `    ${l}` : '')).join('\n') + '\n';
    }
    return out;
  }

  /** `git merge --abort`: put back HEAD's version of everything the merge touched. */
  private async abort(cwd: string): Promise<void> {
    const head = await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
    const headSnapshot = await this.commitSnapshot(cwd, head);
    const index = await indexSnapshot(this.git, cwd);
    const paths = new Set(compareSnapshots(headSnapshot, index).map((c) => c.path));
    const message = (await this.readFile(`${cwd}/.git/MERGE_MSG`)) ?? '';
    const section = message.split('\n# Conflicts:\n')[1];
    if (section) {
      for (const line of section.split('\n')) {
        const m = line.match(/^#\t(.+)$/);
        if (m) paths.add(m[1]);
      }
    }
    for (const path of paths) {
      await writeVersion(this.git, this.fs, cwd, path, headSnapshot.get(path));
      if (!headSnapshot.has(path)) await this.pruneEmptyDirs(cwd, path);
    }
    await clearSequencerState(this.fs, cwd);
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.lstat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async readFile(path: string): Promise<string | undefined> {
    try {
      return await this.fs.readFile(path, 'utf8');
    } catch {
      return undefined;
    }
  }

  private async writeFile(path: string, content: string): Promise<void> {
    await this.fs.writeFile(path, content);
  }
}
