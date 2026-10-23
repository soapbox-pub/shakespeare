import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption, type ParsedArgs } from "./args";
import { abbrev, resolveCommit, RevisionError } from "./revisions";
import { aheadBehind, attachDefaultValues, expandRefFormat, isAncestor, isValidRefName, matchesGlob } from "./refUtils";

interface BranchRow {
  /** Display name (`main`, `remotes/origin/main`, `(HEAD detached at abc1234)`). */
  label: string;
  /** Short name as used with `-r` (`origin/main`). */
  short: string;
  refname: string;
  oid: string;
  current: boolean;
  /** For symbolic refs like `origin/HEAD -> origin/main`. */
  symref?: string;
  local: boolean;
}

export class GitBranchCommand implements GitSubcommand {
  name = 'branch';
  description = 'List, create, or delete branches';
  usage = `git branch [<options>] [-r | -a] [--merged] [--no-merged]
   or: git branch [<options>] [-f] [--recurse-submodules] <branch-name> [<start-point>]
   or: git branch [<options>] [-l] [<pattern>...]
   or: git branch [<options>] [-r] (-d | -D) <branch-name>...
   or: git branch [<options>] (-m | -M) [<old-branch>] <new-branch>
   or: git branch [<options>] (-c | -C) [<old-branch>] <new-branch>
   or: git branch [<options>] [-r | -a] [--points-at]
   or: git branch [<options>] [-r | -a] [--format]`;

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
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git', 128);
      }

      const parsed = parseArgs(attachDefaultValues(args, ['contains', 'no-contains', 'merged', 'no-merged', 'points-at']), {
        flags: {
          d: 'delete', delete: 'delete', D: 'forceDelete', m: 'move', move: 'move', M: 'forceMove',
          c: 'copy', copy: 'copy', C: 'forceCopy', f: 'force', force: 'force',
          a: 'all', all: 'all', r: 'remotes', remotes: 'remotes', l: 'list', list: 'list',
          v: 'verbose', verbose: 'verbose', q: 'quiet', quiet: 'quiet', 'show-current': 'showCurrent',
          'unset-upstream': 'unsetUpstream', t: 'track', track: 'track', i: 'ignoreCase', 'ignore-case': 'ignoreCase',
          column: 'column', 'create-reflog': 'createReflog', 'edit-description': 'editDescription',
        },
        values: {
          u: 'upstream', 'set-upstream-to': 'upstream', format: 'format', sort: 'sort',
          contains: 'contains', 'no-contains': 'noContains', merged: 'merged', 'no-merged': 'noMerged', 'points-at': 'pointsAt',
        },
      });
      // `-vv` counts twice.
      const verbosity = args.filter((a) => /^-[a-zA-Z]*v/.test(a) && !a.startsWith('--')).reduce((n, a) => n + (a.match(/v/g)?.length ?? 0), 0) +
        args.filter((a) => a === '--verbose').length;
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }

      const names = parsed.rest;
      const force = parsed.has('force');

      if (parsed.has('showCurrent')) {
        const current = await this.currentBranch(cwd);
        return createSuccessResult(current ? `${current}\n` : '');
      }
      if (parsed.has('delete') || parsed.has('forceDelete')) {
        return await this.deleteBranches(names, parsed.has('forceDelete') || (parsed.has('delete') && force), parsed.has('remotes'), parsed.has('quiet'), cwd);
      }
      if (parsed.has('move') || parsed.has('forceMove')) {
        return await this.moveOrCopy(names, parsed.has('forceMove') || force, false, cwd);
      }
      if (parsed.has('copy') || parsed.has('forceCopy')) {
        return await this.moveOrCopy(names, parsed.has('forceCopy') || force, true, cwd);
      }
      if (parsed.has('upstream')) {
        return await this.setUpstream(names[0], parsed.get('upstream')!, cwd);
      }
      if (parsed.has('unsetUpstream')) {
        return await this.unsetUpstream(names[0], cwd);
      }
      if (parsed.has('editDescription')) {
        return createErrorResult('error: editing branch descriptions is not supported here', 1);
      }

      const listing = names.length === 0 || parsed.has('list') || parsed.has('all') || parsed.has('remotes') ||
        ['contains', 'noContains', 'merged', 'noMerged', 'pointsAt', 'format', 'sort'].some((n) => parsed.has(n));
      if (listing) {
        return await this.listBranches(parsed, verbosity, names, cwd);
      }

      return await this.createBranch(names, force, parsed, cwd);
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message, 128);
      return createErrorResult(`git branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async currentBranch(cwd: string): Promise<string | undefined> {
    try {
      return (await this.git.currentBranch({ dir: cwd, fullname: false })) || undefined;
    } catch {
      return undefined;
    }
  }

  private async headOid(cwd: string): Promise<string | undefined> {
    try {
      return await this.git.resolveRef({ dir: cwd, ref: 'HEAD' });
    } catch {
      return undefined;
    }
  }

  private async branchExists(cwd: string, name: string): Promise<boolean> {
    try {
      await this.git.resolveRef({ dir: cwd, ref: `refs/heads/${name}` });
      return true;
    } catch {
      return false;
    }
  }

  private async upstreamOf(cwd: string, branch: string): Promise<string | undefined> {
    const remote = await this.git.getConfig({ dir: cwd, path: `branch.${branch}.remote` }) as string | undefined;
    const merge = await this.git.getConfig({ dir: cwd, path: `branch.${branch}.merge` }) as string | undefined;
    if (!remote || !merge) return undefined;
    const name = merge.replace(/^refs\/heads\//, '');
    return remote === '.' ? `refs/heads/${name}` : `refs/remotes/${remote}/${name}`;
  }

  private async rows(cwd: string, local: boolean, remote: boolean): Promise<BranchRow[]> {
    const rows: BranchRow[] = [];
    const current = await this.currentBranch(cwd);
    const all = local && remote;

    if (local) {
      const head = await this.headOid(cwd);
      if (!current && head) {
        rows.push({ label: `(HEAD detached at ${abbrev(head)})`, short: 'HEAD', refname: 'HEAD', oid: head, current: true, local: true });
      }
      for (const name of (await this.git.listBranches({ dir: cwd })).sort(cmp)) {
        let oid: string;
        try {
          oid = await this.git.resolveRef({ dir: cwd, ref: `refs/heads/${name}` });
        } catch {
          continue;
        }
        rows.push({ label: name, short: name, refname: `refs/heads/${name}`, oid, current: name === current, local: true });
      }
    }

    if (remote) {
      let refs: string[] = [];
      try {
        refs = await this.git.listRefs({ dir: cwd, filepath: 'refs/remotes' });
      } catch {
        // No remotes.
      }
      for (const ref of refs.sort(cmp)) {
        const refname = `refs/remotes/${ref}`;
        let symref: string | undefined;
        try {
          const content = (await this.fs.readFile(`${cwd}/.git/${refname}`, 'utf8')).trim();
          if (content.startsWith('ref: ')) symref = content.slice(5).replace(/^refs\/remotes\//, '');
        } catch {
          // Packed.
        }
        let oid: string;
        try {
          oid = await this.git.resolveRef({ dir: cwd, ref: refname });
        } catch {
          continue;
        }
        rows.push({ label: all ? `remotes/${ref}` : ref, short: ref, refname, oid, current: false, symref, local: false });
      }
    }
    return rows;
  }

  private async listBranches(parsed: ParsedArgs, verbosity: number, patterns: string[], cwd: string): Promise<ShellCommandResult> {
    const all = parsed.has('all');
    const remotesOnly = parsed.has('remotes') && !all;
    let rows = await this.rows(cwd, !remotesOnly, all || remotesOnly);

    if (patterns.length > 0) {
      const ic = parsed.has('ignoreCase');
      rows = rows.filter((r) => r.refname !== 'HEAD' && patterns.some((p) =>
        ic ? matchesGlob(r.short.toLowerCase(), p.toLowerCase()) : matchesGlob(r.short, p)));
    }

    const filters: Array<[string, (row: BranchRow, oid: string) => Promise<boolean>]> = [
      ['contains', (r, oid) => isAncestor(this.git, cwd, oid, r.oid)],
      ['noContains', async (r, oid) => !(await isAncestor(this.git, cwd, oid, r.oid))],
      ['merged', (r, oid) => isAncestor(this.git, cwd, r.oid, oid)],
      ['noMerged', async (r, oid) => !(await isAncestor(this.git, cwd, r.oid, oid))],
      ['pointsAt', async (r, oid) => r.oid === oid],
    ];
    for (const [name, pred] of filters) {
      const spec = parsed.get(name);
      if (spec === undefined) continue;
      const oid = await resolveCommit(this.git, cwd, spec);
      const keep = await Promise.all(rows.map((r) => pred(r, oid)));
      rows = rows.filter((_, i) => keep[i]);
    }

    const sort = parsed.get('sort');
    if (sort) {
      const key = sort.replace(/^-/, '');
      if (key === 'committerdate' || key === 'creatordate') {
        const dates = new Map<string, number>();
        for (const r of rows) dates.set(r.oid, (await this.git.readCommit({ dir: cwd, oid: r.oid })).commit.committer.timestamp);
        rows.sort((a, b) => dates.get(a.oid)! - dates.get(b.oid)!);
      }
      if (sort.startsWith('-')) rows.reverse();
    }

    const format = parsed.get('format');
    if (format !== undefined) {
      let out = '';
      for (const r of rows) {
        const subject = await this.subject(cwd, r.oid);
        const upstream = r.local && r.refname !== 'HEAD' ? await this.upstreamOf(cwd, r.short) : undefined;
        out += expandRefFormat(format, { refname: r.refname, short: r.refname === 'HEAD' ? r.label : r.short, oid: r.oid, subject, head: r.current, upstream }) + '\n';
      }
      return createSuccessResult(out);
    }

    if (verbosity === 0) {
      return createSuccessResult(rows.map((r) => `${r.current ? '*' : ' '} ${r.label}${r.symref ? ` -> ${r.symref}` : ''}\n`).join(''));
    }

    const width = Math.max(0, ...rows.filter((r) => !r.symref).map((r) => r.label.length));
    let out = '';
    for (const r of rows) {
      const marker = r.current ? '*' : ' ';
      if (r.symref) {
        out += `${marker} ${r.label} -> ${r.symref}\n`;
        continue;
      }
      let tracking = '';
      if (r.local && r.refname !== 'HEAD') {
        const upstream = await this.upstreamOf(cwd, r.short);
        if (upstream) {
          const short = upstream.replace(/^refs\/(remotes|heads)\//, '');
          let upstreamOid: string | undefined;
          try {
            upstreamOid = await this.git.resolveRef({ dir: cwd, ref: upstream });
          } catch {
            // Gone.
          }
          const parts: string[] = [];
          if (!upstreamOid) {
            parts.push('gone');
          } else {
            const { ahead, behind } = await aheadBehind(this.git, cwd, r.oid, upstreamOid);
            if (ahead) parts.push(`ahead ${ahead}`);
            if (behind) parts.push(`behind ${behind}`);
          }
          if (verbosity > 1) tracking = `[${short}${parts.length ? `: ${parts.join(', ')}` : ''}] `;
          else if (parts.length) tracking = `[${parts.join(', ')}] `;
        }
      }
      out += `${marker} ${r.label.padEnd(width)} ${abbrev(r.oid)} ${tracking}${await this.subject(cwd, r.oid)}\n`;
    }
    return createSuccessResult(out);
  }

  private async subject(cwd: string, oid: string): Promise<string> {
    try {
      const { commit } = await this.git.readCommit({ dir: cwd, oid });
      return commit.message.split('\n')[0];
    } catch {
      return '';
    }
  }

  private async createBranch(names: string[], force: boolean, parsed: ParsedArgs, cwd: string): Promise<ShellCommandResult> {
    if (names.length > 2) return createErrorResult(`usage: ${this.usage}`, 129);
    const [name, start] = names;
    if (!isValidRefName(name)) {
      return createErrorResult(`fatal: '${name}' is not a valid branch name\nhint: See 'git help check-ref-format'`, 128);
    }
    const exists = await this.branchExists(cwd, name);
    if (exists && !force) {
      return createErrorResult(`fatal: a branch named '${name}' already exists`, 128);
    }
    if (exists && (await this.currentBranch(cwd)) === name) {
      return createErrorResult(`fatal: cannot force update the branch '${name}' used by worktree at '${cwd}'`, 128);
    }

    let oid: string;
    try {
      oid = await resolveCommit(this.git, cwd, start ?? 'HEAD');
    } catch {
      if (!start) return createErrorResult(`fatal: not a valid object name: '${(await this.currentBranch(cwd)) ?? 'HEAD'}'`, 128);
      return createErrorResult(`fatal: not a valid object name: '${start}'`, 128);
    }

    await this.git.writeRef({ dir: cwd, ref: `refs/heads/${name}`, value: oid, force: true });

    // Branching from a remote-tracking branch sets it as upstream (branch.autoSetupMerge).
    if (start && !parsed.negated('track')) {
      const remoteRef = await this.remoteTrackingRef(cwd, start);
      if (remoteRef || parsed.has('track')) {
        const target = remoteRef ?? (await this.branchExists(cwd, start) ? `refs/heads/${start}` : undefined);
        if (target) {
          const msg = await this.writeUpstream(cwd, name, target);
          return createSuccessResult(parsed.has('quiet') ? '' : msg);
        }
      }
    }
    return createSuccessResult('');
  }

  /** `origin/main` → `refs/remotes/origin/main`, if it is one. */
  private async remoteTrackingRef(cwd: string, spec: string): Promise<string | undefined> {
    const ref = spec.startsWith('refs/remotes/') ? spec : spec.startsWith('remotes/') ? `refs/${spec}` : `refs/remotes/${spec}`;
    if (!/^refs\/remotes\/[^/]+\/.+/.test(ref) || ref.endsWith('/HEAD')) return undefined;
    if (await this.branchExists(cwd, spec)) return undefined;
    try {
      await this.git.resolveRef({ dir: cwd, ref });
      return ref;
    } catch {
      return undefined;
    }
  }

  private async writeUpstream(cwd: string, branch: string, upstream: string): Promise<string> {
    let remote = '.';
    let merge = upstream;
    const m = upstream.match(/^refs\/remotes\/([^/]+)\/(.+)$/);
    if (m) {
      remote = m[1];
      merge = `refs/heads/${m[2]}`;
    }
    await this.git.setConfig({ dir: cwd, path: `branch.${branch}.remote`, value: remote });
    await this.git.setConfig({ dir: cwd, path: `branch.${branch}.merge`, value: merge });
    const short = m ? `${m[1]}/${m[2]}` : merge.replace(/^refs\/heads\//, '');
    return `branch '${branch}' set up to track '${short}'.\n`;
  }

  private async setUpstream(branchArg: string | undefined, upstream: string, cwd: string): Promise<ShellCommandResult> {
    const branch = branchArg ?? await this.currentBranch(cwd);
    if (!branch) return createErrorResult('fatal: could not set upstream of HEAD to ' + upstream + ' when it does not point to any branch.', 128);
    if (!(await this.branchExists(cwd, branch))) return createErrorResult(`fatal: branch '${branch}' does not exist`, 128);
    const remoteRef = await this.remoteTrackingRef(cwd, upstream);
    const target = remoteRef ?? (await this.branchExists(cwd, upstream) ? `refs/heads/${upstream}` : undefined);
    if (!target) {
      return createErrorResult(`fatal: the requested upstream branch '${upstream}' does not exist\nhint: \nhint: If you are planning on basing your work on an upstream\nhint: branch that already exists at the remote, you may need to\nhint: run "git fetch" to retrieve it.\nhint: \nhint: If you are planning to push out a new local branch that\nhint: will track its remote counterpart, you may want to use\nhint: "git push -u" to set the upstream config as you push.`, 128);
    }
    return createSuccessResult(await this.writeUpstream(cwd, branch, target));
  }

  private async unsetUpstream(branchArg: string | undefined, cwd: string): Promise<ShellCommandResult> {
    const branch = branchArg ?? await this.currentBranch(cwd);
    if (!branch) return createErrorResult('fatal: HEAD does not point to a branch', 128);
    if (!(await this.git.getConfig({ dir: cwd, path: `branch.${branch}.merge` }))) {
      return createErrorResult(`fatal: branch '${branch}' has no upstream information`, 128);
    }
    await this.git.setConfig({ dir: cwd, path: `branch.${branch}.remote`, value: undefined });
    await this.git.setConfig({ dir: cwd, path: `branch.${branch}.merge`, value: undefined });
    return createSuccessResult('');
  }

  private async deleteBranches(names: string[], force: boolean, remotes: boolean, quiet: boolean, cwd: string): Promise<ShellCommandResult> {
    if (names.length === 0) return createErrorResult('fatal: branch name required', 128);
    const current = await this.currentBranch(cwd);
    const head = await this.headOid(cwd);
    let stdout = '';
    let stderr = '';

    for (const name of names) {
      if (remotes) {
        const ref = `refs/remotes/${name}`;
        let oid: string;
        try {
          oid = await this.git.resolveRef({ dir: cwd, ref });
        } catch {
          stderr += `error: remote-tracking branch '${name}' not found\n`;
          continue;
        }
        await this.git.deleteRef({ dir: cwd, ref });
        if (!quiet) stdout += `Deleted remote-tracking branch ${name} (was ${abbrev(oid)}).\n`;
        continue;
      }

      let oid: string;
      try {
        oid = await this.git.resolveRef({ dir: cwd, ref: `refs/heads/${name}` });
      } catch {
        stderr += `error: branch '${name}' not found\n`;
        continue;
      }
      if (name === current) {
        stderr += `error: cannot delete branch '${name}' used by worktree at '${cwd}'\n`;
        continue;
      }
      if (!force) {
        // Merged into its upstream, or else into HEAD.
        const upstream = await this.upstreamOf(cwd, name);
        let into = head;
        if (upstream) {
          try {
            into = await this.git.resolveRef({ dir: cwd, ref: upstream });
          } catch {
            // Upstream gone; fall back to HEAD.
          }
        }
        if (!into || !(await isAncestor(this.git, cwd, oid, into))) {
          stderr += `error: the branch '${name}' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D ${name}'\n`;
          continue;
        }
      }
      await this.git.deleteRef({ dir: cwd, ref: `refs/heads/${name}` });
      await this.removeBranchConfig(cwd, name);
      if (!quiet) stdout += `Deleted branch ${name} (was ${abbrev(oid)}).\n`;
    }
    return { exitCode: stderr ? 1 : 0, stdout, stderr };
  }

  private async moveOrCopy(names: string[], force: boolean, copy: boolean, cwd: string): Promise<ShellCommandResult> {
    const current = await this.currentBranch(cwd);
    let from: string | undefined;
    let to: string;
    if (names.length === 1) {
      from = current;
      to = names[0];
      if (!from) return createErrorResult(`fatal: cannot ${copy ? 'copy' : 'rename'} the current branch while not on any`, 128);
    } else if (names.length === 2) {
      [from, to] = names;
    } else {
      return createErrorResult(copy ? 'fatal: branch name required' : 'fatal: too many arguments for a rename operation', 128);
    }

    if (!(await this.branchExists(cwd, from))) {
      // Renaming the unborn current branch only changes HEAD.
      if (!copy && from === current && !(await this.headOid(cwd))) {
        await this.git.writeRef({ dir: cwd, ref: 'HEAD', value: `refs/heads/${to}`, symbolic: true, force: true });
        return createSuccessResult('');
      }
      return createErrorResult(`error: no branch named '${from}'`, 1);
    }
    if (!isValidRefName(to)) {
      return createErrorResult(`fatal: '${to}' is not a valid branch name\nhint: See 'git help check-ref-format'`, 128);
    }
    if (from === to && !copy) return createSuccessResult('');
    if (await this.branchExists(cwd, to)) {
      if (!force) return createErrorResult(`fatal: a branch named '${to}' already exists`, 128);
      if (to === current) return createErrorResult(`fatal: cannot force update the branch '${to}' used by worktree at '${cwd}'`, 128);
    }

    const oid = await this.git.resolveRef({ dir: cwd, ref: `refs/heads/${from}` });
    await this.git.writeRef({ dir: cwd, ref: `refs/heads/${to}`, value: oid, force: true });
    await this.copyBranchConfig(cwd, from, to);
    if (!copy) {
      await this.git.deleteRef({ dir: cwd, ref: `refs/heads/${from}` });
      await this.removeBranchConfig(cwd, from);
      if (from === current) {
        await this.git.writeRef({ dir: cwd, ref: 'HEAD', value: `refs/heads/${to}`, symbolic: true, force: true });
      }
    }
    return createSuccessResult('');
  }

  private async copyBranchConfig(cwd: string, from: string, to: string): Promise<void> {
    for (const key of ['remote', 'merge', 'rebase', 'description']) {
      const value = await this.git.getConfig({ dir: cwd, path: `branch.${from}.${key}` });
      if (value !== undefined) await this.git.setConfig({ dir: cwd, path: `branch.${to}.${key}`, value });
    }
  }

  private async removeBranchConfig(cwd: string, name: string): Promise<void> {
    for (const key of ['remote', 'merge', 'rebase', 'description']) {
      if ((await this.git.getConfig({ dir: cwd, path: `branch.${name}.${key}` })) !== undefined) {
        await this.git.setConfig({ dir: cwd, path: `branch.${name}.${key}`, value: undefined });
      }
    }
  }
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
