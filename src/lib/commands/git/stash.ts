import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { compareSnapshots, defaultDiffFormat, formatChanges, indexSnapshot, treeSnapshot, workdirSnapshot, ZERO_OID, type FileVersion, type Snapshot } from "./diffing";
import { abbrev, matchesPathspec, resolveCommit } from "./revisions";
import { applyThreeWay, dirtyPaths, writeVersion } from "./threeWay";
import { signature } from "./refUtils";
import { formatTimezone } from "./pretty";
import { GitStatusCommand } from "./status";

/** One entry of the stash reflog (`.git/logs/refs/stash`). */
interface StashEntry {
  oid: string;
  message: string;
  /** `Name <email> <timestamp> <tz>` from the reflog line. */
  who: string;
}

/** A stash named on the command line. */
interface StashRef {
  oid: string;
  /** Position in the reflog, when it is one of its entries. */
  index?: number;
  /** How git names it in messages (`stash@{1}`, `refs/stash@{0}`). */
  label: string;
}

/** Stashes written by the old JSON-based implementation, newest first. */
interface LegacyStashEntry {
  message: string;
  branch: string;
  timestamp: number;
  files: Array<{ filepath: string; content: string; status: 'modified' | 'added' | 'deleted' }>;
}

interface SaveOptions {
  message?: string;
  untracked: boolean;
  all: boolean;
  keepIndex: boolean;
  staged: boolean;
  quiet: boolean;
  pathspecs: string[];
}

class StashError extends Error {
  constructor(message: string, readonly exitCode = 1, readonly stdout = '') {
    super(message);
  }
}

type TreeNode = Map<string, TreeNode | FileVersion>;

const USAGE = `git stash list [<log-options>]
   or: git stash show [-u | --include-untracked | --only-untracked] [<diff-options>] [<stash>]
   or: git stash drop [-q | --quiet] [<stash>]
   or: git stash pop [--index] [-q | --quiet] [<stash>]
   or: git stash apply [--index] [-q | --quiet] [<stash>]
   or: git stash branch <branchname> [<stash>]
   or: git stash [push [-p | --patch] [-S | --staged] [-k | --[no-]keep-index] [-q | --quiet]
          [-u | --include-untracked] [-a | --all] [(-m | --message) <message>]
          [--] [<pathspec>...]]
   or: git stash save [-k | --[no-]keep-index] [-q | --quiet] [-u | --include-untracked] [-a | --all] [<message>]
   or: git stash clear`;

/**
 * `git stash`, stored the way git stores it: `refs/stash` points at a commit
 * whose tree is the working tree, with HEAD, an index commit and (for `-u`)
 * an untracked-files commit as parents; `.git/logs/refs/stash` lists them.
 */
export class GitStashCommand implements GitSubcommand {
  name = 'stash';
  description = 'Stash the changes in a dirty working directory away';
  usage = USAGE;

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

      await this.migrateLegacy(cwd);

      let [sub, ...rest] = args;
      if (sub === undefined || sub.startsWith('-')) {
        sub = 'push';
        rest = args;
      }

      switch (sub) {
        case 'push':
          return await this.push(rest, cwd);
        case 'save':
          return await this.saveCommand(rest, cwd);
        case 'list':
          return await this.list(cwd);
        case 'show':
          return await this.show(rest, cwd);
        case 'apply':
          return await this.applyCommand(rest, cwd, false);
        case 'pop':
          return await this.applyCommand(rest, cwd, true);
        case 'drop':
          return await this.drop(rest, cwd);
        case 'clear':
          await this.writeEntries(cwd, []);
          return createSuccessResult('');
        case 'branch':
          return await this.branch(rest, cwd);
        default:
          return createErrorResult(`error: unknown subcommand: \`${sub}'\nusage: ${USAGE}`, 129);
      }
    } catch (error) {
      if (error instanceof StashError) return { exitCode: error.exitCode, stdout: error.stdout, stderr: error.message };
      return createErrorResult(`git stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async push(args: string[], cwd: string): Promise<ShellCommandResult> {
    const parsed = parseArgs(args, {
      flags: {
        u: 'untracked', 'include-untracked': 'untracked', a: 'all', all: 'all', k: 'keepIndex', 'keep-index': 'keepIndex',
        q: 'quiet', quiet: 'quiet', p: 'patch', patch: 'patch', S: 'staged', staged: 'staged',
      },
      values: { m: 'message', message: 'message' },
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], USAGE), 129);
    if (parsed.has('patch')) return createErrorResult('error: interactive stashing (--patch) is not supported here; pass pathspecs instead', 1);
    return this.save(cwd, {
      message: parsed.has('message') ? parsed.getAll('message').join('\n\n') : undefined,
      untracked: parsed.has('untracked') || parsed.has('all'),
      all: parsed.has('all'),
      keepIndex: parsed.has('keepIndex'),
      staged: parsed.has('staged'),
      quiet: parsed.has('quiet'),
      pathspecs: parsed.rest,
    });
  }

  private async saveCommand(args: string[], cwd: string): Promise<ShellCommandResult> {
    const parsed = parseArgs(args, {
      flags: {
        u: 'untracked', 'include-untracked': 'untracked', a: 'all', all: 'all', k: 'keepIndex', 'keep-index': 'keepIndex',
        q: 'quiet', quiet: 'quiet', p: 'patch', patch: 'patch',
      },
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], USAGE), 129);
    return this.save(cwd, {
      message: parsed.rest.length > 0 ? parsed.rest.join(' ') : undefined,
      untracked: parsed.has('untracked') || parsed.has('all'),
      all: parsed.has('all'),
      keepIndex: parsed.has('keepIndex'),
      staged: false,
      quiet: parsed.has('quiet'),
      pathspecs: [],
    });
  }

  private async save(cwd: string, opts: SaveOptions): Promise<ShellCommandResult> {
    let head: string;
    try {
      head = await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
    } catch {
      return createErrorResult('You do not have the initial commit yet', 1);
    }
    const branch = (await this.currentBranch(cwd)) ?? '(no branch)';
    const { commit: headCommit } = await this.git.readCommit({ dir: cwd, oid: head });
    const desc = `${branch}: ${abbrev(head)} ${headCommit.message.split('\n')[0]}`;

    const headSnap = await treeSnapshot(this.git, cwd, headCommit.tree);
    const index = await indexSnapshot(this.git, cwd);
    const work = await workdirSnapshot(this.git, this.fs, cwd, index);
    const specs = opts.pathspecs;
    const inSpec = (path: string) => matchesPathspec(path, specs);

    const untracked = opts.untracked && !opts.staged ? (await this.untrackedFiles(cwd, index, opts.all)).filter(inSpec) : [];

    if (specs.length > 0) {
      const known = [...headSnap.keys(), ...index.keys(), ...untracked];
      const unmatched = specs.find((spec) => !known.some((p) => matchesPathspec(p, [spec])));
      if (unmatched) return createErrorResult(`error: pathspec '${unmatched}' did not match any file(s) known to git\nDid you forget to 'git add'?`, 1);
    }

    const indexTree: Snapshot = new Map(headSnap);
    for (const c of compareSnapshots(headSnap, index, specs)) {
      if (c.new) indexTree.set(c.path, c.new);
      else indexTree.delete(c.path);
    }
    const workTree: Snapshot = new Map(indexTree);
    if (!opts.staged) {
      for (const c of compareSnapshots(index, work, specs)) {
        if (c.new) workTree.set(c.path, c.new);
        else workTree.delete(c.path);
      }
    }

    const staged = compareSnapshots(headSnap, indexTree);
    const changed = compareSnapshots(headSnap, workTree);
    if (staged.length === 0 && changed.length === 0 && untracked.length === 0) {
      return createSuccessResult(opts.quiet ? '' : 'No local changes to save\n');
    }

    const sig = await signature(this.git, this.fs, cwd);
    const indexCommit = await this.git.writeCommit({
      dir: cwd,
      commit: { tree: await this.writeTree(cwd, indexTree), parent: [head], author: sig, committer: sig, message: `index on ${desc}\n` },
    });
    const parents = [head, indexCommit];
    if (untracked.length > 0) {
      const files: Snapshot = new Map();
      for (const path of untracked) {
        const content = await this.fs.readFile(`${cwd}/${path}`);
        const oid = await this.git.writeBlob({ dir: cwd, blob: content });
        files.set(path, { oid, mode: '100644' });
      }
      parents.push(await this.git.writeCommit({
        dir: cwd,
        commit: { tree: await this.writeTree(cwd, files), parent: [], author: sig, committer: sig, message: `untracked files on ${desc}\n` },
      }));
    }
    const message = opts.message !== undefined ? `On ${branch}: ${opts.message}` : `WIP on ${desc}`;
    const stash = await this.git.writeCommit({
      dir: cwd,
      commit: { tree: await this.writeTree(cwd, workTree), parent: parents, author: sig, committer: sig, message: `${message}\n` },
    });

    const entries = await this.readEntries(cwd);
    entries.unshift({ oid: stash, message, who: `${sig.name} <${sig.email}> ${sig.timestamp} ${formatTimezone(sig.timezoneOffset)}` });
    await this.writeEntries(cwd, entries);

    // Put the stashed paths back to HEAD.
    const touched = new Set([...staged.map((c) => c.path), ...changed.map((c) => c.path)]);
    for (const path of touched) {
      await writeVersion(this.git, this.fs, cwd, path, headSnap.get(path));
      if (!headSnap.has(path)) await this.pruneEmptyDirs(cwd, path);
    }
    if (opts.keepIndex || opts.staged) {
      for (const c of staged) {
        if (opts.keepIndex) await writeVersion(this.git, this.fs, cwd, c.path, indexTree.get(c.path));
      }
      if (opts.staged) {
        // Unstaged changes stay in the working tree.
        for (const c of compareSnapshots(index, work, specs)) {
          if (!touched.has(c.path)) continue;
          await writeVersion(this.git, this.fs, cwd, c.path, c.new, false);
        }
      }
    }
    for (const path of untracked) {
      await this.fs.unlink(`${cwd}/${path}`);
      await this.pruneEmptyDirs(cwd, path);
    }

    return createSuccessResult(opts.quiet ? '' : `Saved working directory and index state ${message}\n`);
  }

  private async list(cwd: string): Promise<ShellCommandResult> {
    const entries = await this.readEntries(cwd);
    return createSuccessResult(entries.map((e, i) => `stash@{${i}}: ${e.message}\n`).join(''));
  }

  private async show(args: string[], cwd: string): Promise<ShellCommandResult> {
    const parsed = parseArgs(args, {
      flags: {
        p: 'patch', patch: 'patch', u: 'untracked', 'include-untracked': 'untracked', 'only-untracked': 'onlyUntracked',
        stat: 'stat', 'name-only': 'nameOnly', 'name-status': 'nameStatus', numstat: 'numstat', shortstat: 'shortstat',
      },
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], USAGE), 129);
    const ref = await this.resolveStash(cwd, parsed.positionals[0]);
    const { commit } = await this.git.readCommit({ dir: cwd, oid: ref.oid });
    const base = await this.commitTree(cwd, commit.parent[0]);
    const untracked = commit.parent[2] ? await this.commitTree(cwd, commit.parent[2]) : new Map<string, FileVersion>();

    let from = base;
    let to = await treeSnapshot(this.git, cwd, commit.tree);
    if (parsed.has('onlyUntracked')) {
      from = new Map();
      to = untracked;
    } else if (parsed.has('untracked')) {
      to = new Map([...to, ...untracked]);
    }

    const format = { ...defaultDiffFormat(), patch: parsed.has('patch') };
    format.nameOnly = parsed.has('nameOnly');
    format.nameStatus = parsed.has('nameStatus');
    format.numstat = parsed.has('numstat');
    format.shortstat = parsed.has('shortstat');
    format.stat = parsed.has('stat') || !(format.patch || format.nameOnly || format.nameStatus || format.numstat || format.shortstat);
    return createSuccessResult(await formatChanges(this.git, cwd, compareSnapshots(from, to), format));
  }

  private async applyCommand(args: string[], cwd: string, pop: boolean): Promise<ShellCommandResult> {
    const parsed = parseArgs(args, { flags: { index: 'index', q: 'quiet', quiet: 'quiet' } });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], USAGE), 129);
    const ref = await this.resolveStash(cwd, parsed.positionals[0]);
    if (pop && ref.index === undefined) return createErrorResult(`error: '${parsed.positionals[0]}' is not a stash reference`, 1);
    return this.applyStash(cwd, ref, { index: parsed.has('index'), quiet: parsed.has('quiet'), pop });
  }

  private async applyStash(cwd: string, ref: StashRef, opts: { index: boolean; quiet: boolean; pop: boolean }): Promise<ShellCommandResult> {
    const kept = opts.pop ? 'The stash entry is kept in case you need it again.\n' : '';
    const { commit } = await this.git.readCommit({ dir: cwd, oid: ref.oid });
    const base = await this.commitTree(cwd, commit.parent[0]);
    const theirs = await treeSnapshot(this.git, cwd, commit.tree);
    const stashedIndex = commit.parent[1] ? await this.commitTree(cwd, commit.parent[1]) : base;
    const untracked = commit.parent[2] ? await this.commitTree(cwd, commit.parent[2]) : new Map<string, FileVersion>();

    const head = await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
    const ours = await this.commitTree(cwd, head);

    const changes = compareSnapshots(base, theirs);
    const dirty = await dirtyPaths(this.git, this.fs, cwd, ours);
    const blocked = changes.map((c) => c.path).filter((p) => dirty.has(p));
    if (blocked.length > 0) {
      return createErrorResult(
        'error: Your local changes to the following files would be overwritten by merge:\n' +
        blocked.map((p) => `\t${p}\n`).join('') +
        `Please commit your changes or stash them before you merge.\nAborting\n${kept}`,
        1,
      );
    }
    const existing: string[] = [];
    for (const path of untracked.keys()) {
      if (await this.exists(`${cwd}/${path}`)) existing.push(path);
    }
    if (existing.length > 0) {
      return createErrorResult(`${existing.map((p) => `${p} already exists, no checkout\n`).join('')}error: could not restore untracked files from stash\n${kept}`, 1);
    }

    const result = await applyThreeWay(this.git, this.fs, cwd, {
      base, theirs, ours, ourLabel: 'Updated upstream', theirLabel: 'Stashed changes',
    }, 'merge');

    // Only new files stay staged, unless --index restores the stashed index.
    const stagedChanges = opts.index ? compareSnapshots(base, stashedIndex) : [];
    const stagedPaths = new Set(stagedChanges.map((c) => c.path));
    for (const path of result.updated) {
      if (stagedPaths.has(path) || !ours.has(path)) continue;
      await this.git.resetIndex({ dir: cwd, filepath: path });
    }
    const conflicted = new Set(result.conflicted);
    for (const c of stagedChanges) {
      if (conflicted.has(c.path)) continue;
      if (c.new) {
        await this.git.updateIndex({ dir: cwd, filepath: c.path, oid: c.new.oid, mode: parseInt(c.new.mode, 8), add: true });
      } else {
        await this.git.remove({ dir: cwd, filepath: c.path });
      }
    }
    for (const [path, version] of untracked) {
      await writeVersion(this.git, this.fs, cwd, path, version, false);
    }

    let out = '';
    for (const c of changes) {
      const o = ours.get(c.path);
      const b = base.get(c.path);
      if (o && b && c.new && o.oid !== b.oid && o.oid !== c.new.oid) out += `Auto-merging ${c.path}\n`;
    }
    out += result.conflicts.map((c) => `${c}\n`).join('');
    if (!opts.quiet || result.conflicted.length > 0) {
      out += (await new GitStatusCommand(this.options).execute([], cwd)).stdout;
    }

    if (result.conflicted.length > 0) {
      return { exitCode: 1, stdout: out + kept, stderr: '' };
    }
    if (opts.pop && ref.index !== undefined) {
      await this.dropEntry(cwd, ref.index);
      if (!opts.quiet) out += `Dropped ${ref.label} (${ref.oid})\n`;
    }
    return createSuccessResult(out);
  }

  private async drop(args: string[], cwd: string): Promise<ShellCommandResult> {
    const parsed = parseArgs(args, { flags: { q: 'quiet', quiet: 'quiet' } });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], USAGE), 129);
    const ref = await this.resolveStash(cwd, parsed.positionals[0]);
    if (ref.index === undefined) return createErrorResult(`error: '${parsed.positionals[0]}' is not a stash reference`, 1);
    await this.dropEntry(cwd, ref.index);
    return createSuccessResult(parsed.has('quiet') ? '' : `Dropped ${ref.label} (${ref.oid})\n`);
  }

  private async branch(args: string[], cwd: string): Promise<ShellCommandResult> {
    const [name, spec] = args;
    if (!name) return createErrorResult('No branch name specified', 1);
    const ref = await this.resolveStash(cwd, spec);
    try {
      await this.git.resolveRef({ dir: cwd, ref: `refs/heads/${name}` });
      return createErrorResult(`fatal: a branch named '${name}' already exists`, 128);
    } catch {
      // Good: it doesn't.
    }
    const { commit } = await this.git.readCommit({ dir: cwd, oid: ref.oid });
    await this.git.branch({ dir: cwd, ref: name, object: commit.parent[0] });
    await this.git.checkout({ dir: cwd, ref: name });
    const result = await this.applyStash(cwd, ref, { index: true, quiet: false, pop: ref.index !== undefined });
    return { ...result, stdout: `Switched to a new branch '${name}'\n${result.stdout}` };
  }

  private async resolveStash(cwd: string, spec: string | undefined): Promise<StashRef> {
    const entries = await this.readEntries(cwd);
    if (spec === undefined) {
      if (entries.length === 0) throw new StashError('No stash entries found.', 1);
      return { oid: entries[0].oid, index: 0, label: 'refs/stash@{0}' };
    }
    const m = spec.match(/^(?:(?:refs\/)?stash@\{(\d+)\}|(\d+))$/);
    if (m) {
      const n = parseInt(m[1] ?? m[2], 10);
      if (entries.length === 0) throw new StashError('No stash entries found.', 1);
      if (n >= entries.length) throw new StashError(`fatal: log for 'stash' only has ${entries.length} entries`, 128);
      return { oid: entries[n].oid, index: n, label: m[1] !== undefined ? spec : `stash@{${n}}` };
    }
    let oid: string;
    try {
      oid = await resolveCommit(this.git, cwd, spec === 'stash' ? 'refs/stash' : spec);
    } catch (error) {
      throw new StashError(error instanceof Error ? error.message : `fatal: ${spec} is not a valid reference`, 128);
    }
    const { commit } = await this.git.readCommit({ dir: cwd, oid });
    if (commit.parent.length < 2) throw new StashError(`error: '${spec}' is not a stash-like commit`, 1);
    const index = entries.findIndex((e) => e.oid === oid);
    return { oid, index: index === -1 ? undefined : index, label: spec };
  }

  private async readEntries(cwd: string): Promise<StashEntry[]> {
    let text = '';
    try {
      text = await this.fs.readFile(`${cwd}/.git/logs/refs/stash`, 'utf8');
    } catch {
      // No reflog.
    }
    const entries: StashEntry[] = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^[0-9a-f]{40} ([0-9a-f]{40}) (.*?)\t(.*)$/);
      if (m) entries.push({ oid: m[1], who: m[2], message: m[3] });
    }
    if (entries.length === 0) {
      // A stash ref without a reflog.
      try {
        const oid = await this.git.resolveRef({ dir: cwd, ref: 'refs/stash' });
        const { commit } = await this.git.readCommit({ dir: cwd, oid });
        entries.push({ oid, who: '', message: commit.message.split('\n')[0] });
      } catch {
        // No stash.
      }
    }
    return entries.reverse();
  }

  private async writeEntries(cwd: string, entries: StashEntry[]): Promise<void> {
    const logPath = `${cwd}/.git/logs/refs/stash`;
    if (entries.length === 0) {
      try {
        await this.fs.unlink(logPath);
      } catch {
        // Not there.
      }
      try {
        await this.git.deleteRef({ dir: cwd, ref: 'refs/stash' });
      } catch {
        // Not there.
      }
      return;
    }
    let prev = ZERO_OID;
    let text = '';
    for (const entry of [...entries].reverse()) {
      text += `${prev} ${entry.oid} ${entry.who}\t${entry.message}\n`;
      prev = entry.oid;
    }
    await this.fs.mkdir(`${cwd}/.git/logs/refs`, { recursive: true });
    await this.fs.writeFile(logPath, text);
    await this.git.writeRef({ dir: cwd, ref: 'refs/stash', value: entries[0].oid, force: true });
  }

  private async dropEntry(cwd: string, index: number): Promise<void> {
    const entries = await this.readEntries(cwd);
    entries.splice(index, 1);
    await this.writeEntries(cwd, entries);
  }

  private async currentBranch(cwd: string): Promise<string | undefined> {
    try {
      return (await this.git.currentBranch({ dir: cwd })) || undefined;
    } catch {
      return undefined;
    }
  }

  private async commitTree(cwd: string, oid: string): Promise<Snapshot> {
    const { commit } = await this.git.readCommit({ dir: cwd, oid });
    return treeSnapshot(this.git, cwd, commit.tree);
  }

  /** Write a snapshot as a tree object (and any blobs only it holds). */
  private async writeTree(cwd: string, snapshot: Snapshot): Promise<string> {
    const root: TreeNode = new Map();
    for (const [path, version] of snapshot) {
      const parts = path.split('/');
      let node = root;
      for (const part of parts.slice(0, -1)) {
        let next = node.get(part);
        if (!(next instanceof Map)) {
          next = new Map();
          node.set(part, next);
        }
        node = next;
      }
      node.set(parts[parts.length - 1], version);
    }
    const write = async (node: TreeNode): Promise<string> => {
      const tree: Array<{ mode: string; path: string; oid: string; type: 'blob' | 'tree' | 'commit' }> = [];
      for (const [name, child] of node) {
        if (child instanceof Map) {
          tree.push({ mode: '040000', path: name, oid: await write(child), type: 'tree' });
        } else {
          if (child.content) await this.git.writeBlob({ dir: cwd, blob: child.content });
          tree.push({ mode: child.mode, path: name, oid: child.oid, type: child.mode === '160000' ? 'commit' : 'blob' });
        }
      }
      return this.git.writeTree({ dir: cwd, tree });
    };
    return write(root);
  }

  /** Untracked files, skipping ignored ones unless `all`. */
  private async untrackedFiles(cwd: string, index: Snapshot, all: boolean): Promise<string[]> {
    const out: string[] = [];
    const walk = async (prefix: string): Promise<void> => {
      let names: string[];
      try {
        names = await this.fs.readdir(prefix ? `${cwd}/${prefix}` : cwd);
      } catch {
        return;
      }
      for (const name of names.sort()) {
        if (name === '.git') continue;
        const path = prefix ? `${prefix}/${name}` : name;
        const isDir = (await this.fs.lstat(`${cwd}/${path}`)).isDirectory();
        if (!all && !index.has(path) && await this.git.isIgnored({ dir: cwd, filepath: isDir ? `${path}/` : path }).catch(() => false)) continue;
        if (isDir) await walk(path);
        else if (!index.has(path)) out.push(path);
      }
    };
    await walk('');
    return out;
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

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.lstat(path);
      return true;
    } catch {
      return false;
    }
  }

  /** Turn stashes saved by the old JSON implementation into real stash commits. */
  private async migrateLegacy(cwd: string): Promise<void> {
    const path = `${cwd}/.git/shakespeare_stash.json`;
    let legacy: LegacyStashEntry[];
    try {
      legacy = JSON.parse(await this.fs.readFile(path, 'utf8')) as LegacyStashEntry[];
    } catch {
      return;
    }
    let head: string;
    try {
      head = await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
    } catch {
      return;
    }
    const headSnap = await this.commitTree(cwd, head);
    const headTree = (await this.git.readCommit({ dir: cwd, oid: head })).commit.tree;
    const migrated: StashEntry[] = [];
    for (const entry of Array.isArray(legacy) ? legacy : []) {
      const snapshot: Snapshot = new Map(headSnap);
      const encoder = new TextEncoder();
      for (const file of entry.files ?? []) {
        if (file.status === 'deleted') {
          snapshot.delete(file.filepath);
        } else {
          const oid = await this.git.writeBlob({ dir: cwd, blob: encoder.encode(file.content) });
          snapshot.set(file.filepath, { oid, mode: headSnap.get(file.filepath)?.mode ?? '100644' });
        }
      }
      const sig = await signature(this.git, this.fs, cwd);
      const when = { ...sig, timestamp: Math.floor((entry.timestamp || Date.now()) / 1000) };
      const message = entry.message.startsWith('WIP on') ? entry.message : `On ${entry.branch}: ${entry.message}`;
      const indexCommit = await this.git.writeCommit({
        dir: cwd,
        commit: { tree: headTree, parent: [head], author: when, committer: when, message: `index on ${entry.branch}\n` },
      });
      const oid = await this.git.writeCommit({
        dir: cwd,
        commit: { tree: await this.writeTree(cwd, snapshot), parent: [head, indexCommit], author: when, committer: when, message: `${message}\n` },
      });
      migrated.push({ oid, message, who: `${when.name} <${when.email}> ${when.timestamp} ${formatTimezone(when.timezoneOffset)}` });
    }
    await this.writeEntries(cwd, [...(await this.readEntries(cwd)), ...migrated]);
    await this.fs.unlink(path);
  }
}
