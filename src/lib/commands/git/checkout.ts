import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { treeSnapshot, type Snapshot } from "./diffing";
import { abbrev, resolveCommit, resolveTree, RevisionError } from "./revisions";
import {
  NOT_A_REPO, appendHeadReflog, branchExists, commitSubject, currentBranch, describeHead, fatal, headIsNowAt, headOid,
  isRepo, localChanges, normalizePathspecs, output, pathspecDidNotMatch, previousCheckout, restorePaths, switchTrees,
  trackingInfo, trackingMessage,
} from "./worktree";

const DETACHED_ADVICE = `You are in 'detached HEAD' state. You can look around, make experimental
changes and commit them, and you can discard any commits you make in this
state without impacting any branches by switching back to a branch.

If you want to create a new branch to retain commits you create, you may
do so (now or later) by using -c with the switch command. Example:

  git switch -c <new-branch-name>

Or undo this operation with:

  git switch -

Turn off this advice by setting config variable advice.detachedHead to false
`;

export interface SwitchContext {
  git: Git;
  fs: JSRuntimeFS;
  dir: string;
  force: boolean;
  quiet: boolean;
}

/** HEAD's tree as a snapshot (empty on an unborn branch). */
async function headTree(git: Git, dir: string): Promise<Snapshot> {
  const oid = await headOid(git, dir);
  if (!oid) return new Map();
  const { commit } = await git.readCommit({ dir, oid });
  return treeSnapshot(git, dir, commit.tree);
}

async function commitTree(git: Git, dir: string, oid: string): Promise<Snapshot> {
  const { commit } = await git.readCommit({ dir, oid });
  return treeSnapshot(git, dir, commit.tree);
}

/** Text shown when leaving a detached HEAD. */
async function previousPosition(git: Git, dir: string, branch: string | undefined, from: string | undefined, to: string): Promise<string> {
  if (branch || !from || from === to) return '';
  return `Previous HEAD position was ${abbrev(from)} ${await commitSubject(git, dir, from)}\n`;
}

async function trackingText(ctx: SwitchContext, branch: string): Promise<string> {
  const tracking = await trackingInfo(ctx.git, ctx.dir, branch);
  return tracking ? trackingMessage(tracking) : '';
}

/** `git checkout <branch>` / `git switch <branch>`. */
export async function switchToBranch(ctx: SwitchContext, branch: string): Promise<ShellCommandResult> {
  const { git, fs, dir } = ctx;
  const current = await currentBranch(git, dir);
  const from = await headOid(git, dir);
  const target = await git.resolveRef({ dir, ref: `refs/heads/${branch}` });

  const error = await switchTrees(git, fs, dir, await headTree(git, dir), await commitTree(git, dir, target), { force: ctx.force });
  if (error) return createErrorResult(error);

  if (current === branch) {
    if (ctx.quiet) return output('');
    return output('', `${await localChanges(git, fs, dir)}Already on '${branch}'\n${await trackingText(ctx, branch)}`);
  }

  const previous = await previousPosition(git, dir, current, from, target);
  await git.writeRef({ dir, ref: 'HEAD', value: `refs/heads/${branch}`, symbolic: true, force: true });
  await appendHeadReflog(git, fs, dir, from, target, `checkout: moving from ${describeHead(current, from)} to ${branch}`);
  if (ctx.quiet) return output('');
  return output('', `${previous}${await localChanges(git, fs, dir)}Switched to branch '${branch}'\n${await trackingText(ctx, branch)}`);
}

/** `git checkout <commit>` / `git switch --detach <commit>`. */
export async function detachAt(ctx: SwitchContext, spec: string, oid: string, advise = true): Promise<ShellCommandResult> {
  const { git, fs, dir } = ctx;
  const current = await currentBranch(git, dir);
  const from = await headOid(git, dir);

  const error = await switchTrees(git, fs, dir, await headTree(git, dir), await commitTree(git, dir, oid), { force: ctx.force });
  if (error) return createErrorResult(error);

  const previous = await previousPosition(git, dir, current, from, oid);
  await git.writeRef({ dir, ref: 'HEAD', value: oid, force: true });
  await appendHeadReflog(git, fs, dir, from, oid, `checkout: moving from ${describeHead(current, from)} to ${spec}`);
  if (ctx.quiet) return output('');

  let message = previous + await localChanges(git, fs, dir);
  if (current && advise) {
    const advice = await git.getConfig({ dir, path: 'advice.detachedHead' });
    message += `Note: switching to '${spec}'.\n\n`;
    if (advice !== false && advice !== 'false') message += `${DETACHED_ADVICE}\n`;
  }
  message += `${await headIsNowAt(git, dir, oid)}\n`;
  return output('', message);
}

/** The remote-tracking branch a start point names, if it is one (`origin/main`). */
async function remoteTrackingStart(git: Git, dir: string, start: string): Promise<{ remote: string; branch: string } | undefined> {
  const name = start.replace(/^refs\/remotes\//, '');
  const slash = name.indexOf('/');
  if (slash === -1) return undefined;
  try {
    await git.resolveRef({ dir, ref: `refs/remotes/${name}` });
  } catch {
    return undefined;
  }
  const remotes = await git.listRemotes({ dir });
  const remote = remotes.find((r) => name.startsWith(`${r.remote}/`));
  if (!remote) return undefined;
  return { remote: remote.remote, branch: name.slice(remote.remote.length + 1) };
}

export interface CreateOptions {
  /** `-B` / `-C`: reset the branch if it exists. */
  reset: boolean;
  /** `--track` was given (tracking is also set up automatically for remote-tracking start points). */
  track?: boolean;
  noTrack?: boolean;
}

/** `git checkout -b <branch> [<start>]` / `git switch -c <branch> [<start>]`. */
export async function createAndSwitch(ctx: SwitchContext, branch: string, start: string | undefined, options: CreateOptions): Promise<ShellCommandResult> {
  const { git, fs, dir } = ctx;
  if (!isValidBranchName(branch)) return fatal(`'${branch}' is not a valid branch name`);

  const exists = await branchExists(git, dir, branch);
  if (exists && !options.reset) return fatal(`a branch named '${branch}' already exists`);

  const current = await currentBranch(git, dir);
  const from = await headOid(git, dir);

  let target: string | undefined;
  if (start !== undefined) {
    try {
      target = await resolveCommit(git, dir, start);
    } catch {
      return fatal(`'${start}' is not a commit and a branch '${branch}' cannot be created from it`);
    }
  } else {
    target = from;
  }

  if (target) {
    const error = await switchTrees(git, fs, dir, await headTree(git, dir), await commitTree(git, dir, target), { force: ctx.force });
    if (error) return createErrorResult(error);
    await git.writeRef({ dir, ref: `refs/heads/${branch}`, value: target, force: true });
  }

  let messages = '';
  const upstream = start !== undefined && !options.noTrack ? await remoteTrackingStart(git, dir, start) : undefined;
  if (upstream) {
    await git.setConfig({ dir, path: `branch.${branch}.remote`, value: upstream.remote });
    await git.setConfig({ dir, path: `branch.${branch}.merge`, value: `refs/heads/${upstream.branch}` });
    messages += `branch '${branch}' set up to track '${upstream.remote}/${upstream.branch}'.\n`;
  }

  await git.writeRef({ dir, ref: 'HEAD', value: `refs/heads/${branch}`, symbolic: true, force: true });
  if (target) await appendHeadReflog(git, fs, dir, from, target, `checkout: moving from ${describeHead(current, from)} to ${branch}`);
  if (ctx.quiet) return output('');

  const previous = target ? await previousPosition(git, dir, current, from, target) : '';
  let line: string;
  if (!exists) line = `Switched to a new branch '${branch}'`;
  else if (current === branch) line = `Reset branch '${branch}'`;
  else line = `Switched to and reset branch '${branch}'`;
  return output('', `${previous}${messages}${await localChanges(git, fs, dir)}${line}\n${await trackingText(ctx, branch)}`);
}

/** `--orphan <branch>`: start an unborn branch, keeping the index and working tree. */
export async function orphan(ctx: SwitchContext, branch: string): Promise<ShellCommandResult> {
  const { git, dir } = ctx;
  if (await branchExists(git, dir, branch)) return fatal(`a branch named '${branch}' already exists`);
  await git.writeRef({ dir, ref: 'HEAD', value: `refs/heads/${branch}`, symbolic: true, force: true });
  return output('', ctx.quiet ? '' : `Switched to a new branch '${branch}'\n`);
}

export function isValidBranchName(name: string): boolean {
  return !(
    !name || name.startsWith('-') || name.startsWith('/') || name.endsWith('/') || name.endsWith('.') ||
    name.endsWith('.lock') || name.includes('..') || name.includes('//') || name.includes('@{') || name === '@' ||
    /[\s~^:?*[\\\x00-\x1f\x7f]/.test(name) || name.split('/').some((part) => part.startsWith('.'))
  );
}

/** A remote-tracking branch with this name on exactly one remote, for `git checkout <name>` DWIM. */
export async function guessRemoteBranch(git: Git, dir: string, name: string): Promise<string | undefined> {
  const matches: string[] = [];
  for (const { remote } of await git.listRemotes({ dir })) {
    try {
      await git.resolveRef({ dir, ref: `refs/remotes/${remote}/${name}` });
      matches.push(`${remote}/${name}`);
    } catch {
      // Not on this remote.
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

/** Resolve `-` to the previously checked-out branch or commit. */
export async function resolvePrevious(fs: JSRuntimeFS, dir: string): Promise<string | undefined> {
  return previousCheckout(fs, dir);
}

export class GitCheckoutCommand implements GitSubcommand {
  name = 'checkout';
  description = 'Switch branches or restore working tree files';
  usage = 'git checkout [<options>] <branch>\n   or: git checkout [<options>] [<branch>] -- <file>...';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      if (!(await isRepo(this.fs, cwd))) return fatal(NOT_A_REPO);

      const parsed = parseArgs(args, {
        flags: {
          q: 'quiet', quiet: 'quiet', f: 'force', force: 'force', detach: 'detach', d: 'detach',
          m: 'merge', merge: 'merge', t: 'track', track: 'track', p: 'patch', patch: 'patch',
          progress: 'progress', guess: 'guess', overlay: 'overlay', ours: 'ours', theirs: 'theirs',
          'ignore-other-worktrees': 'ignoreOtherWorktrees', 'ignore-skip-worktree-bits': 'ignoreSkipWorktreeBits',
        },
        values: { b: 'create', B: 'reset', orphan: 'orphan', conflict: 'conflict' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('patch')) {
        return fatal('interactive patch mode (-p) is not supported here; restore whole files instead (git checkout <commit> -- <file>)');
      }

      const ctx: SwitchContext = { git: this.git, fs: this.fs, dir: cwd, force: parsed.has('force'), quiet: parsed.has('quiet') };
      const positionals = [...parsed.positionals];
      if (positionals[0] === '-') {
        const previous = await resolvePrevious(this.fs, cwd);
        if (!previous) return fatal('invalid reference: @{-1}');
        positionals[0] = previous;
      }

      const createName = parsed.get('reset') ?? parsed.get('create');
      if (createName !== undefined) {
        if (positionals.length > 1 || parsed.paths.length > 0) {
          return fatal(`'${positionals[1] ?? parsed.paths[0]}' is not a commit and a branch '${createName}' cannot be created from it`);
        }
        return await createAndSwitch(ctx, createName, positionals[0], {
          reset: parsed.has('reset'),
          noTrack: parsed.negated('track'),
        });
      }

      const orphanName = parsed.get('orphan');
      if (orphanName !== undefined) return await orphan(ctx, orphanName);

      // `git checkout [<tree-ish>] -- <paths>`
      if (parsed.dashDash) {
        if (positionals.length > 1) return fatal(`only one reference expected, ${positionals.length} given.`);
        return await this.checkoutPaths(cwd, positionals[0], parsed.paths, false, ctx.quiet);
      }

      if (positionals.length === 0) {
        if (parsed.has('detach')) return await detachAt(ctx, 'HEAD', await resolveCommit(this.git, cwd, 'HEAD'));
        if (ctx.force) return await this.forceHead(ctx);
        const branch = await currentBranch(this.git, cwd);
        return output(branch ? await trackingText(ctx, branch) : '');
      }

      const [first, ...rest] = positionals;

      if (!parsed.has('detach') && (await branchExists(this.git, cwd, first))) {
        if (rest.length > 0) return await this.checkoutPaths(cwd, first, rest, true, ctx.quiet);
        return await switchToBranch(ctx, first);
      }

      let oid: string | undefined;
      try {
        oid = rest.length > 0 ? await resolveTree(this.git, cwd, first) : await resolveCommit(this.git, cwd, first);
      } catch (error) {
        if (!(error instanceof RevisionError)) throw error;
      }

      if (oid !== undefined) {
        if (rest.length > 0) return await this.checkoutPaths(cwd, first, rest, true, ctx.quiet);
        return await detachAt(ctx, first, oid);
      }

      if (parsed.has('detach')) return fatal(`invalid reference: ${first}`);

      if (rest.length === 0 && !parsed.negated('guess')) {
        const remote = await guessRemoteBranch(this.git, cwd, first);
        if (remote) return await createAndSwitch(ctx, first, remote, { reset: false });
      }

      // Not a revision: everything is a path, restored from the index.
      return await this.checkoutPaths(cwd, undefined, positionals, true, ctx.quiet);
    } catch (error) {
      if (error instanceof RevisionError) return fatal(error.message);
      return createErrorResult(`git checkout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** `git checkout -f` with no branch: throw away local changes to tracked files. */
  private async forceHead(ctx: SwitchContext): Promise<ShellCommandResult> {
    const tree = await headTree(this.git, ctx.dir);
    await switchTrees(this.git, this.fs, ctx.dir, tree, tree, { force: true });
    const branch = await currentBranch(this.git, ctx.dir);
    return output(branch && !ctx.quiet ? await trackingText(ctx, branch) : '');
  }

  private async checkoutPaths(cwd: string, treeish: string | undefined, paths: string[], report: boolean, quiet: boolean): Promise<ShellCommandResult> {
    if (paths.length === 0) {
      return treeish === undefined ? output('') : fatal(`you must specify path(s) to restore`);
    }
    const normalized = normalizePathspecs(cwd, paths);
    if ('error' in normalized) return normalized.error;

    let source: Snapshot | undefined;
    let sourceName = 'the index';
    if (treeish !== undefined) {
      let treeOid: string;
      try {
        treeOid = await resolveTree(this.git, cwd, treeish);
      } catch (error) {
        if (error instanceof RevisionError) return fatal(`invalid reference: ${treeish}`);
        throw error;
      }
      source = await treeSnapshot(this.git, cwd, treeOid);
      sourceName = abbrev(treeOid);
    }

    const { unmatched, count } = await restorePaths(this.git, this.fs, cwd, normalized.specs, {
      source,
      staged: source !== undefined,
      worktree: true,
      overlay: true,
    });
    if (unmatched.length > 0) {
      return createErrorResult(unmatched.map((i) => pathspecDidNotMatch(paths[i])).join('\n'));
    }
    if (!report || quiet) return output('');
    return output('', `Updated ${count} path${count === 1 ? '' : 's'} from ${sourceName}\n`);
  }
}
