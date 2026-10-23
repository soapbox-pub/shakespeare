import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { treeSnapshot } from "./diffing";
import { abbrev, matchesPathspec } from "./revisions";
import { readSequencerHead } from "./sequencer";
import {
  NOT_A_REPO, collapseUntracked, currentBranch, detachedDescription, fatal, headOid, isRepo, listWorktree, normalizePathspecs, output,
  readIndexSnapshot, readStatus, trackingInfo, trackingMessage, type Tracking,
} from "./worktree";

type UntrackedMode = 'no' | 'normal' | 'all';

interface Entry {
  /** Two-letter short status (`M `, ` D`, `??`, `UU`, ...). */
  code: string;
  path: string;
  /** The source of a rename. */
  from?: string;
}

interface State {
  branch?: string;
  head?: string;
  detached?: string;
  tracking?: Tracking;
  operation?: { kind: 'merge' } | { kind: 'cherry-pick' | 'revert'; oid: string };
  staged: Entry[];
  unstaged: Entry[];
  unmerged: Entry[];
  untracked: string[];
  ignored: string[];
}

const STAGED_LABEL: Record<string, string> = { A: 'new file:', M: 'modified:', D: 'deleted:', R: 'renamed:' };

export class GitStatusCommand implements GitSubcommand {
  name = 'status';
  description = 'Show the working tree status';
  usage = 'git status [<options>] [--] [<pathspec>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      if (!(await isRepo(this.fs, cwd))) return fatal(NOT_A_REPO);

      // `-u` takes an optional attached value (`-uno`), which the generic parser can't express.
      const expanded = args.map((arg) => {
        const match = arg.match(/^-u(no|normal|all)?$/);
        return match ? `--untracked-files=${match[1] ?? 'all'}` : arg;
      });
      const parsed = parseArgs(expanded, {
        flags: {
          s: 'short', short: 'short', b: 'branch', branch: 'branch', long: 'long', z: 'z', v: 'verbose', verbose: 'verbose',
          renames: 'renames', 'show-stash': 'showStash', 'ahead-behind': 'aheadBehind', column: 'column',
        },
        optional: { porcelain: 'porcelain', 'untracked-files': 'untracked', ignored: 'ignored', 'find-renames': 'findRenames' },
        values: { 'ignore-submodules': 'ignoreSubmodules' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }

      const porcelainVersion = parsed.get('porcelain') ?? (parsed.has('porcelain') ? 'v1' : undefined);
      if (porcelainVersion !== undefined && porcelainVersion !== 'v1' && porcelainVersion !== '1') {
        if (porcelainVersion === 'v2' || porcelainVersion === '2') return fatal('--porcelain=v2 is not supported here; use --porcelain or --short');
        return fatal(`unsupported porcelain version '${porcelainVersion}'`);
      }
      const untrackedMode = (parsed.get('untracked') ?? (parsed.has('untracked') ? 'all' : 'normal')) as UntrackedMode;
      if (!['no', 'normal', 'all'].includes(untrackedMode)) {
        return fatal(`Invalid untracked files mode '${untrackedMode}'`);
      }
      const showIgnored = parsed.has('ignored') && parsed.get('ignored') !== 'no';

      const normalized = normalizePathspecs(cwd, parsed.rest);
      if ('error' in normalized) return normalized.error;

      const state = await this.collect(cwd, normalized.specs, untrackedMode, showIgnored, !parsed.negated('aheadBehind'));
      const short = parsed.has('short') || porcelainVersion !== undefined || (parsed.has('z') && !parsed.has('long'));
      if (short && !parsed.has('long')) {
        return output(this.formatShort(state, parsed.has('branch'), parsed.has('z')));
      }
      return output(this.formatLong(state, untrackedMode));
    } catch (error) {
      return createErrorResult(`git status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async collect(cwd: string, specs: string[], untrackedMode: UntrackedMode, showIgnored: boolean, aheadBehind: boolean): Promise<State> {
    const branch = await currentBranch(this.git, cwd);
    const head = await headOid(this.git, cwd);
    const state: State = { branch, head, staged: [], unstaged: [], unmerged: [], untracked: [], ignored: [] };
    if (!branch && head) state.detached = await detachedDescription(this.git, this.fs, cwd, head);
    if (branch && head && aheadBehind) state.tracking = await trackingInfo(this.git, cwd, branch);

    const cherryPick = await readSequencerHead(this.fs, cwd, 'cherry-pick');
    const revert = await readSequencerHead(this.fs, cwd, 'revert');
    if (cherryPick) state.operation = { kind: 'cherry-pick', oid: cherryPick };
    else if (revert) state.operation = { kind: 'revert', oid: revert };
    else if (await this.fileExists(`${cwd}/.git/MERGE_HEAD`)) state.operation = { kind: 'merge' };

    const matches = (path: string) => matchesPathspec(path, specs);
    const all = await readStatus(this.git, this.fs, cwd);
    const rows = all.filter((s) => matches(s.path));

    for (const s of rows) {
      if (s.staged !== ' ') state.staged.push({ code: `${s.staged} `, path: s.path });
    }
    await this.detectRenames(cwd, state);

    for (const s of rows) {
      if (s.unstaged === ' ') continue;
      if (state.operation && s.unstaged === 'M' && (await this.hasConflictMarkers(cwd, s.path))) {
        state.unmerged.push({ code: 'UU', path: s.path });
      } else {
        state.unstaged.push({ code: s.unstaged, path: s.path });
      }
    }

    if (untrackedMode !== 'no') {
      const untracked = rows.filter((s) => s.untracked).map((s) => s.path);
      const tracked = all.filter((s) => s.inIndex).map((s) => s.path);
      state.untracked = untrackedMode === 'all' ? untracked : collapseUntracked(untracked, tracked);
    }
    if (showIgnored) {
      const tracked = new Set(all.filter((s) => s.inIndex).map((s) => s.path));
      state.ignored = (await listWorktree(this.fs, cwd)).ignored.filter((p) => !tracked.has(p) && matches(p.replace(/\/$/, '')));
    }
    return state;
  }

  /** Pair staged deletions and additions of identical content as renames. */
  private async detectRenames(cwd: string, state: State): Promise<void> {
    const added = state.staged.filter((e) => e.code === 'A ');
    const deleted = state.staged.filter((e) => e.code === 'D ');
    if (added.length === 0 || deleted.length === 0) return;

    const index = await readIndexSnapshot(this.git, cwd);
    const head = state.head ? await this.headSnapshot(cwd, state.head) : new Map();
    const byOid = new Map<string, Entry[]>();
    for (const entry of deleted) {
      const oid = head.get(entry.path)?.oid;
      if (oid) byOid.set(oid, [...(byOid.get(oid) ?? []), entry]);
    }
    const removed = new Set<Entry>();
    for (const entry of added) {
      const oid = index.get(entry.path)?.oid;
      const source = oid ? byOid.get(oid)?.shift() : undefined;
      if (!source) continue;
      entry.code = 'R ';
      entry.from = source.path;
      removed.add(source);
    }
    state.staged = state.staged.filter((e) => !removed.has(e));
  }

  private async headSnapshot(cwd: string, oid: string) {
    const { commit } = await this.git.readCommit({ dir: cwd, oid });
    return treeSnapshot(this.git, cwd, commit.tree);
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await this.fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async hasConflictMarkers(cwd: string, path: string): Promise<boolean> {
    try {
      const text = await this.fs.readFile(`${cwd}/${path}`, 'utf8');
      return /^<<<<<<< /m.test(text) && /^>>>>>>> /m.test(text);
    } catch {
      return false;
    }
  }

  private formatShort(state: State, showBranch: boolean, nul: boolean): string {
    const end = nul ? '\0' : '\n';
    let out = '';
    if (showBranch) {
      if (!state.head) out += `## No commits yet on ${state.branch ?? 'HEAD'}`;
      else if (!state.branch) out += '## HEAD (no branch)';
      else {
        out += `## ${state.branch}`;
        const t = state.tracking;
        if (t) {
          out += `...${t.upstream}`;
          if (t.gone) out += ' [gone]';
          else if (t.ahead || t.behind) {
            out += ` [${[t.ahead ? `ahead ${t.ahead}` : '', t.behind ? `behind ${t.behind}` : ''].filter(Boolean).join(', ')}]`;
          }
        }
      }
      out += end;
    }

    // One line per path, combining its staged and unstaged letters.
    const lines = new Map<string, { x: string; y: string; from?: string }>();
    for (const e of state.staged) lines.set(e.path, { x: e.code[0], y: ' ', from: e.from });
    for (const e of state.unstaged) {
      const line = lines.get(e.path) ?? { x: ' ', y: ' ' };
      line.y = e.code;
      lines.set(e.path, line);
    }
    for (const e of state.unmerged) lines.set(e.path, { x: 'U', y: 'U' });

    for (const path of [...lines.keys()].sort()) {
      const { x, y, from } = lines.get(path)!;
      if (from) out += nul ? `${x}${y} ${path}\0${from}\0` : `${x}${y} ${from} -> ${path}\n`;
      else out += `${x}${y} ${path}${end}`;
    }
    for (const path of state.untracked) out += `?? ${path}${end}`;
    for (const path of state.ignored) out += `!! ${path}${end}`;
    return out;
  }

  private formatLong(state: State, untrackedMode: UntrackedMode): string {
    let out = '';
    if (state.branch) out += `On branch ${state.branch}\n`;
    else out += `HEAD detached ${state.detached ?? 'at HEAD'}\n`;

    if (state.tracking) out += `${trackingMessage(state.tracking)}\n`;
    if (!state.head) out += '\nNo commits yet\n\n';

    const op = state.operation;
    const conflicted = state.unmerged.length > 0;
    if (op?.kind === 'merge') {
      out += conflicted
        ? 'You have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n\n'
        : 'All conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n\n';
    } else if (op) {
      const verb = op.kind === 'cherry-pick' ? 'cherry-picking' : 'reverting';
      out += `You are currently ${verb} commit ${abbrev(op.oid)}.\n`;
      out += conflicted
        ? `  (fix conflicts and run "git ${op.kind} --continue")\n`
        : `  (all conflicts fixed: run "git ${op.kind} --continue")\n`;
      out += `  (use "git ${op.kind} --skip" to skip this patch)\n`;
      out += `  (use "git ${op.kind} --abort" to cancel the ${op.kind} operation)\n\n`;
    }

    if (state.staged.length > 0) {
      out += 'Changes to be committed:\n';
      if (!op) out += state.head ? '  (use "git restore --staged <file>..." to unstage)\n' : '  (use "git rm --cached <file>..." to unstage)\n';
      for (const e of state.staged) {
        const label = STAGED_LABEL[e.code[0]].padEnd(12);
        out += `\t${label}${e.from ? `${e.from} -> ${e.path}` : e.path}\n`;
      }
      out += '\n';
    }

    if (state.unmerged.length > 0) {
      out += 'Unmerged paths:\n  (use "git add <file>..." to mark resolution)\n';
      for (const e of state.unmerged) out += `\t${'both modified:'.padEnd(17)}${e.path}\n`;
      out += '\n';
    }

    if (state.unstaged.length > 0) {
      const hasDeletion = state.unstaged.some((e) => e.code === 'D');
      out += 'Changes not staged for commit:\n';
      out += `  (use "git ${hasDeletion ? 'add/rm' : 'add'} <file>..." to update what will be committed)\n`;
      out += '  (use "git restore <file>..." to discard changes in working directory)\n';
      for (const e of state.unstaged) out += `\t${(e.code === 'D' ? 'deleted:' : 'modified:').padEnd(12)}${e.path}\n`;
      out += '\n';
    }

    if (state.untracked.length > 0) {
      out += 'Untracked files:\n  (use "git add <file>..." to include in what will be committed)\n';
      for (const path of state.untracked) out += `\t${path}\n`;
      out += '\n';
    }

    if (state.ignored.length > 0) {
      out += 'Ignored files:\n  (use "git add -f <file>..." to include in what will be committed)\n';
      for (const path of state.ignored) out += `\t${path}\n`;
      out += '\n';
    }

    const hasStaged = state.staged.length > 0;
    const hasUnstaged = state.unstaged.length > 0 || state.unmerged.length > 0;
    if (hasStaged) {
      if (untrackedMode === 'no') out += 'Untracked files not listed (use -u option to show untracked files)\n';
    } else if (hasUnstaged) {
      out += 'no changes added to commit (use "git add" and/or "git commit -a")\n';
    } else if (state.untracked.length > 0) {
      out += 'nothing added to commit but untracked files present (use "git add" to track)\n';
    } else if (untrackedMode === 'no') {
      out += 'nothing to commit (use -u to show untracked files)\n';
    } else if (!state.head) {
      out += 'nothing to commit (create/copy files and use "git add" to track)\n';
    } else {
      out += 'nothing to commit, working tree clean\n';
    }
    return out;
  }
}

