import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { treeSnapshot, type Snapshot } from "./diffing";
import { resolveCommit, resolveTree, RevisionError, unknownRevision } from "./revisions";
import { clearSequencerState } from "./sequencer";
import {
  NOT_A_REPO, SEPARATE_PATHS_HINT, appendHeadReflog, currentBranch, exists, fatal, headIsNowAt, headOid, isRepo,
  matchesAny, normalizePathspecs, output, readIndexSnapshot, readStatus, switchTrees, syncIndexEntry,
} from "./worktree";

type Mode = 'soft' | 'mixed' | 'hard' | 'merge' | 'keep';

export class GitResetCommand implements GitSubcommand {
  name = 'reset';
  description = 'Reset current HEAD to the specified state';
  usage = 'git reset [--mixed | --soft | --hard | --merge | --keep] [-q] [<commit>]\n   or: git reset [-q] [<tree-ish>] [--] <pathspec>...';

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
          soft: 'soft', mixed: 'mixed', hard: 'hard', merge: 'merge', keep: 'keep',
          q: 'quiet', quiet: 'quiet', p: 'patch', patch: 'patch', N: 'intentToAdd', 'intent-to-add': 'intentToAdd',
          refresh: 'refresh', 'recurse-submodules': 'recurseSubmodules',
        },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('patch')) {
        return fatal('interactive patch mode (-p) is not supported here; reset whole files instead (git reset <commit> -- <file>)');
      }

      const modes = (['soft', 'mixed', 'hard', 'merge', 'keep'] as const).filter((m) => parsed.has(m));
      const mode: Mode = modes[modes.length - 1] ?? 'mixed';
      const quiet = parsed.has('quiet');

      // Split the arguments into a revision and paths, as git does.
      let rev: string | undefined;
      let paths: string[];
      if (parsed.dashDash) {
        if (parsed.positionals.length > 1) {
          return fatal(`${unknownRevision(parsed.positionals[1])}\n${SEPARATE_PATHS_HINT}`);
        }
        rev = parsed.positionals[0];
        paths = parsed.paths;
      } else {
        const [first, ...rest] = parsed.positionals;
        if (first !== undefined && (await this.isTreeish(cwd, first))) {
          rev = first;
          paths = rest;
        } else {
          paths = parsed.positionals;
        }
        for (const path of rev === undefined ? paths : []) {
          if (!(await this.isKnownPath(cwd, path))) {
            return fatal(`${unknownRevision(path)}\n${SEPARATE_PATHS_HINT}`);
          }
        }
      }

      if (paths.length > 0) {
        if (mode === 'soft' || mode === 'hard' || mode === 'merge' || mode === 'keep') {
          return fatal(`Cannot do ${mode} reset with paths.`);
        }
        const warning = modes.includes('mixed') ? "warning: --mixed with paths is deprecated; use 'git reset -- <paths>' instead.\n" : '';
        const result = await this.resetPaths(cwd, rev, paths, quiet);
        return { ...result, stderr: warning + result.stderr };
      }

      return await this.resetCommit(cwd, rev, mode, quiet);
    } catch (error) {
      if (error instanceof RevisionError) return fatal(error.message);
      return createErrorResult(`git reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async isTreeish(cwd: string, spec: string): Promise<boolean> {
    try {
      await resolveTree(this.git, cwd, spec);
      return true;
    } catch {
      return false;
    }
  }

  /** A path that exists in the working tree, the index, or HEAD. */
  private async isKnownPath(cwd: string, arg: string): Promise<boolean> {
    const normalized = normalizePathspecs(cwd, [arg]);
    if ('error' in normalized) return false;
    const [spec] = normalized.specs;
    if (spec === '.' || /[*?[]/.test(spec)) return true;
    if (await exists(this.fs, `${cwd}/${spec}`)) return true;
    const index = await readIndexSnapshot(this.git, cwd);
    if ([...index.keys()].some((p) => matchesAny(p, spec))) return true;
    const head = await this.treeOf(cwd, 'HEAD');
    return [...head.keys()].some((p) => matchesAny(p, spec));
  }

  private async treeOf(cwd: string, spec: string): Promise<Snapshot> {
    if (spec === 'HEAD' && !(await headOid(this.git, cwd))) return new Map();
    return treeSnapshot(this.git, cwd, await resolveTree(this.git, cwd, spec));
  }

  private async unstagedReport(cwd: string, quiet: boolean): Promise<string> {
    if (quiet) return '';
    const lines = (await readStatus(this.git, this.fs, cwd))
      .filter((s) => s.inIndex && s.unstaged !== ' ')
      .map((s) => `${s.unstaged}\t${s.path}\n`);
    return lines.length > 0 ? `Unstaged changes after reset:\n${lines.join('')}` : '';
  }

  /** Point the index at `target` for every path (optionally only those matching `specs`). */
  private async resetIndex(cwd: string, target: Snapshot, specs?: string[]): Promise<void> {
    const index = await readIndexSnapshot(this.git, cwd);
    for (const path of [...new Set([...index.keys(), ...target.keys()])].sort()) {
      if (specs && !specs.some((spec) => matchesAny(path, spec))) continue;
      const current = index.get(path);
      const wanted = target.get(path);
      if (current?.oid === wanted?.oid && current?.mode === wanted?.mode) continue;
      await syncIndexEntry(this.git, this.fs, cwd, path, wanted);
    }
  }

  private async resetPaths(cwd: string, rev: string | undefined, paths: string[], quiet: boolean): Promise<ShellCommandResult> {
    const normalized = normalizePathspecs(cwd, paths);
    if ('error' in normalized) return normalized.error;
    const target = await this.treeOf(cwd, rev ?? 'HEAD');
    await this.resetIndex(cwd, target, normalized.specs);
    return output(await this.unstagedReport(cwd, quiet));
  }

  private async resetCommit(cwd: string, rev: string | undefined, mode: Mode, quiet: boolean): Promise<ShellCommandResult> {
    const current = await headOid(this.git, cwd);
    const spec = rev ?? 'HEAD';

    let target: string | undefined;
    if (rev === undefined && !current) {
      target = undefined;
    } else {
      try {
        target = await resolveCommit(this.git, cwd, spec);
      } catch (error) {
        if (error instanceof RevisionError) return fatal(`${unknownRevision(spec)}\n${SEPARATE_PATHS_HINT}`);
        throw error;
      }
    }

    const targetTree: Snapshot = target ? await this.treeOf(cwd, target) : new Map();
    const currentTree: Snapshot = current ? await this.treeOf(cwd, current) : new Map();

    if (mode === 'hard') {
      await switchTrees(this.git, this.fs, cwd, currentTree, targetTree, { force: true });
    } else if (mode === 'keep' || mode === 'merge') {
      const error = await switchTrees(this.git, this.fs, cwd, currentTree, targetTree, { force: false, operation: 'reset' });
      if (error) return createErrorResult(`${error}\nfatal: Could not reset index file to revision '${spec}'.`, 128);
    } else if (mode === 'mixed') {
      await this.resetIndex(cwd, targetTree);
    }

    if (target && target !== current) {
      const branch = await currentBranch(this.git, cwd);
      await this.git.writeRef({ dir: cwd, ref: branch ? `refs/heads/${branch}` : 'HEAD', value: target, force: true });
      if (current) await this.fs.writeFile(`${cwd}/.git/ORIG_HEAD`, `${current}\n`);
      await appendHeadReflog(this.git, this.fs, cwd, current, target, `reset: moving to ${spec}`);
    }
    if (mode !== 'soft') await clearSequencerState(this.fs, cwd);

    if (mode === 'hard') return output(quiet || !target ? '' : `${await headIsNowAt(this.git, cwd, target)}\n`);
    if (mode === 'mixed') return output(await this.unstagedReport(cwd, quiet));
    return output('');
  }
}
