import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { NOT_A_REPO, fatal, isRepo, matchesAny, normalizePathspecs, output, readStatus, removeWorktreeFile } from "./worktree";

export class GitRmCommand implements GitSubcommand {
  name = 'rm';
  description = 'Remove files from the working tree and from the index';
  usage = 'git rm [-f | --force] [-n] [-r] [--cached] [--ignore-unmatch] [--quiet] [--] <pathspec>...';

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
          f: 'force', force: 'force', n: 'dryRun', 'dry-run': 'dryRun', r: 'recursive', R: 'recursive', recursive: 'recursive',
          cached: 'cached', 'ignore-unmatch': 'ignoreUnmatch', q: 'quiet', quiet: 'quiet', sparse: 'sparse',
        },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }

      const paths = parsed.rest;
      if (paths.length === 0) {
        return createErrorResult(`usage: ${this.usage}`, 129);
      }
      const normalized = normalizePathspecs(cwd, paths);
      if ('error' in normalized) return normalized.error;

      const force = parsed.has('force');
      const cached = parsed.has('cached');
      const recursive = parsed.has('recursive');

      const status = (await readStatus(this.git, this.fs, cwd)).filter((s) => s.inIndex);

      const targets = new Set<string>();
      for (let i = 0; i < normalized.specs.length; i++) {
        const spec = normalized.specs[i];
        const hits = status.filter((s) => matchesAny(s.path, spec));
        if (hits.length === 0) {
          if (parsed.has('ignoreUnmatch')) continue;
          return fatal(`pathspec '${paths[i]}' did not match any files`);
        }
        const isGlob = /[*?[]/.test(spec);
        if (!recursive && !isGlob && !hits.some((s) => s.path === spec)) {
          return fatal(`not removing '${paths[i]}' recursively without -r`);
        }
        for (const s of hits) targets.add(s.path);
      }

      if (!force) {
        const both: string[] = [];
        const staged: string[] = [];
        const local: string[] = [];
        for (const s of status) {
          if (!targets.has(s.path)) continue;
          const stagedChange = s.staged !== ' ';
          const localChange = s.unstaged === 'M';
          if (stagedChange && localChange) both.push(s.path);
          else if (!cached && stagedChange) staged.push(s.path);
          else if (!cached && localChange) local.push(s.path);
        }
        const errors: string[] = [];
        const list = (files: string[]) => files.map((f) => `    ${f}\n`).join('');
        if (both.length > 0) {
          errors.push(`error: the following ${both.length === 1 ? 'file has' : 'files have'} staged content different from both the\nfile and the HEAD:\n${list(both)}(use -f to force removal)\n`);
        }
        if (staged.length > 0) {
          errors.push(`error: the following ${staged.length === 1 ? 'file has' : 'files have'} changes staged in the index:\n${list(staged)}(use --cached to keep the file, or -f to force removal)\n`);
        }
        if (local.length > 0) {
          errors.push(`error: the following ${local.length === 1 ? 'file has' : 'files have'} local modifications:\n${list(local)}(use --cached to keep the file, or -f to force removal)\n`);
        }
        if (errors.length > 0) return createErrorResult(errors.join(''));
      }

      const removed = [...targets].sort();
      if (!parsed.has('dryRun')) {
        for (const path of removed) {
          await this.git.remove({ dir: cwd, filepath: path });
          if (!cached) await removeWorktreeFile(this.fs, cwd, path);
        }
      }
      return output(parsed.has('quiet') ? '' : removed.map((p) => `rm '${p}'\n`).join(''));
    } catch (error) {
      return createErrorResult(`git rm: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
