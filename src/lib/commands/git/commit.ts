import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { compareSnapshots, formatSummary, countLines, readVersion, treeSnapshot, indexSnapshot, workdirSnapshot } from "./diffing";
import { abbrev, matchesPathspec, resolveCommit, RevisionError } from "./revisions";
import { clearSequencerState, readMergeHead, readMergeMessage } from "./sequencer";

export class GitCommitCommand implements GitSubcommand {
  name = 'commit';
  description = 'Record changes to the repository';
  usage = 'git commit [-a] [-q] [-m <msg>]... [-F <file>] [--amend] [--no-edit] [--allow-empty] [-s] [--author=<author>] [-C <commit>] [--] [<pathspec>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const parsed = parseArgs(args, {
        flags: {
          a: 'all', all: 'all', q: 'quiet', quiet: 'quiet', v: 'verbose', verbose: 'verbose',
          amend: 'amend', edit: 'edit', e: 'edit', 'allow-empty': 'allowEmpty', 'allow-empty-message': 'allowEmptyMessage',
          s: 'signoff', signoff: 'signoff', n: 'noVerify', 'no-verify': 'noVerify', verify: 'verify',
          o: 'only', only: 'only', i: 'include', include: 'include', 'dry-run': 'dryRun',
        },
        values: {
          m: 'message', message: 'message', F: 'file', file: 'file', author: 'author', date: 'date',
          C: 'reuse', 'reuse-message': 'reuse', c: 'reuse', 'reedit-message': 'reuse', t: 'template', template: 'template',
          cleanup: 'cleanup',
        },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage));
      }

      const quiet = parsed.has('quiet');
      const amend = parsed.has('amend');
      const pathspecs = parsed.rest;

      // Resolve HEAD (absent in a new repository)
      let headOid: string | undefined;
      try {
        headOid = await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
      } catch {
        headOid = undefined;
      }
      if (amend && !headOid) {
        return createErrorResult('fatal: You have nothing to amend.');
      }
      const headCommit = headOid ? (await this.git.readCommit({ dir: cwd, oid: headOid })).commit : undefined;

      // Build the message
      const parts = [...parsed.getAll('message')];
      for (const file of parsed.getAll('file')) {
        try {
          const path = file.startsWith('/') ? file : `${cwd}/${file}`;
          parts.push((await this.fs.readFile(path, 'utf8')).replace(/\n+$/, ''));
        } catch {
          return createErrorResult(`fatal: could not read log file '${file}': No such file or directory`);
        }
      }
      let message: string | undefined = parts.length > 0 ? parts.join('\n\n') : undefined;

      let author: { name: string; email: string; timestamp?: number; timezoneOffset?: number } | undefined;
      const reuse = parsed.get('reuse');
      if (reuse !== undefined) {
        try {
          const oid = await resolveCommit(this.git, cwd, reuse);
          const { commit } = await this.git.readCommit({ dir: cwd, oid });
          message ??= commit.message;
          author = commit.author;
        } catch (error) {
          if (error instanceof RevisionError) return createErrorResult(`fatal: could not lookup commit '${reuse}'`);
          throw error;
        }
      }
      if (message === undefined && amend && headCommit) {
        message = headCommit.message;
        author = headCommit.author;
      }
      if (message === undefined) {
        message = await readMergeMessage(this.fs, cwd);
      }
      if (message === undefined || (!message.trim() && !parsed.has('allowEmptyMessage'))) {
        return createErrorResult('Aborting commit due to empty commit message.');
      }

      const authorOverride = parsed.get('author');
      if (authorOverride !== undefined) {
        const match = authorOverride.match(/^(.+?)\s*<(.*)>\s*$/);
        if (!match) return createErrorResult(`fatal: --author '${authorOverride}' is not 'Name <email>' and matches no existing author`);
        author = { name: match[1].trim(), email: match[2].trim() };
      }

      if (parsed.has('signoff')) {
        const name = await this.git.getConfig({ dir: cwd, path: 'user.name' });
        const email = await this.git.getConfig({ dir: cwd, path: 'user.email' });
        if (name && email) {
          const line = `Signed-off-by: ${name} <${email}>`;
          if (!message.includes(line)) message = `${message.replace(/\n+$/, '')}\n\n${line}`;
        }
      }

      // Stage what was asked for
      if (parsed.has('all') || pathspecs.length > 0) {
        const staged = await this.stageTracked(cwd, pathspecs);
        if (pathspecs.length > 0 && staged === 0) {
          return createErrorResult(`error: pathspec '${pathspecs[0]}' did not match any file(s) known to git`);
        }
      }

      // Compare the index with the parent tree
      const parentTree = amend ? (headCommit!.parent[0] ? (await this.git.readCommit({ dir: cwd, oid: headCommit!.parent[0] })).commit.tree : null) : headCommit?.tree ?? null;
      const before = await treeSnapshot(this.git, cwd, parentTree);
      const index = await indexSnapshot(this.git, cwd);
      const changes = compareSnapshots(before, index);
      const headChanges = headCommit ? compareSnapshots(await treeSnapshot(this.git, cwd, headCommit.tree), index) : changes;

      const mergeHead = amend ? undefined : await readMergeHead(this.fs, cwd);
      if (mergeHead && pathspecs.length > 0) {
        return createErrorResult('fatal: cannot do a partial commit during a merge.');
      }

      if (!amend && !mergeHead && headChanges.length === 0 && !parsed.has('allowEmpty')) {
        return createErrorResult(await this.nothingToCommit(cwd, index));
      }

      if (parsed.has('dryRun')) {
        return createSuccessResult(changes.map((c) => `\t${c.status === 'A' ? 'new file' : c.status === 'D' ? 'deleted' : 'modified'}:   ${c.path}\n`).join(''));
      }

      const oid = await this.git.commit({
        dir: cwd,
        message: message.endsWith('\n') ? message : `${message}\n`,
        ...(author ? { author } : {}),
        ...(amend ? { amend: true } : {}),
        ...(mergeHead && headOid ? { parent: [headOid, mergeHead] } : {}),
      });
      await clearSequencerState(this.fs, cwd);

      if (quiet) return createSuccessResult('');

      const branch = (await this.git.currentBranch({ dir: cwd })) || 'detached HEAD';
      const subject = message.trim().split('\n')[0];
      const root = !headOid || (amend && !headCommit?.parent.length) ? ' (root-commit)' : '';
      let out = `[${branch}${root} ${abbrev(oid)}] ${subject}\n`;

      let added = 0;
      let removed = 0;
      for (const change of changes) {
        const counts = countLines(await readVersion(this.git, cwd, change.old), await readVersion(this.git, cwd, change.new));
        added += counts?.added ?? 0;
        removed += counts?.removed ?? 0;
      }
      out += formatSummary(changes.length, added, removed) + '\n';
      for (const change of changes) {
        if (change.status === 'A') out += ` create mode ${change.new!.mode} ${change.path}\n`;
        else if (change.status === 'D') out += ` delete mode ${change.old!.mode} ${change.path}\n`;
      }
      return createSuccessResult(out);
    } catch (error) {
      return createErrorResult(`git commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Stage modifications and deletions of tracked files (optionally limited to pathspecs). */
  private async stageTracked(cwd: string, pathspecs: string[]): Promise<number> {
    // Compare contents rather than trusting statusMatrix, whose stat cache
    // misses same-size edits made within a second of the last index update.
    const index = await indexSnapshot(this.git, cwd);
    const workdir = await workdirSnapshot(this.git, this.fs, cwd, index);
    let matched = 0;
    for (const [filepath, version] of index) {
      if (!matchesPathspec(filepath, pathspecs)) continue;
      matched++;
      const current = workdir.get(filepath);
      if (!current) {
        await this.git.remove({ dir: cwd, filepath });
      } else if (current.oid !== version.oid) {
        await this.git.add({ dir: cwd, filepath });
      }
    }
    return matched;
  }

  private async nothingToCommit(cwd: string, index: Awaited<ReturnType<typeof indexSnapshot>>): Promise<string> {
    const workdir = await workdirSnapshot(this.git, this.fs, cwd, index);
    const unstaged = compareSnapshots(index, workdir);
    const branch = (await this.git.currentBranch({ dir: cwd })) || 'HEAD';
    if (unstaged.length > 0) {
      const lines = unstaged.map((c) => `\t${c.status === 'D' ? 'deleted' : 'modified'}:   ${c.path}`);
      return `On branch ${branch}\nChanges not staged for commit:\n${lines.join('\n')}\n\nno changes added to commit (use "git add" and/or "git commit -a")`;
    }
    const untracked = (await this.git.statusMatrix({ dir: cwd })).some(([, head, , stage]) => head === 0 && stage === 0);
    if (untracked) {
      return `On branch ${branch}\nnothing added to commit but untracked files present (use "git add" to track)`;
    }
    return `On branch ${branch}\nnothing to commit, working tree clean`;
  }
}
