import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { NOT_A_REPO, expandDirectories, fatal, isRepo, listWorktree, matchesAny, normalizePathspecs, output, readStatus } from "./worktree";

export class GitAddCommand implements GitSubcommand {
  name = 'add';
  description = 'Add file contents to the index';
  usage = 'git add [<options>] [--] <pathspec>...';

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
          A: 'all', all: 'all', 'no-ignore-removal': 'all', u: 'update', update: 'update', f: 'force', force: 'force',
          n: 'dryRun', 'dry-run': 'dryRun', v: 'verbose', verbose: 'verbose', p: 'patch', patch: 'patch',
          i: 'interactive', interactive: 'interactive', e: 'edit', edit: 'edit', N: 'intentToAdd', 'intent-to-add': 'intentToAdd',
          'ignore-errors': 'ignoreErrors', 'ignore-missing': 'ignoreMissing', 'ignore-removal': 'ignoreRemoval',
          refresh: 'refresh', renormalize: 'renormalize', sparse: 'sparse',
        },
        values: { chmod: 'chmod' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('patch') || parsed.has('interactive') || parsed.has('edit')) {
        return fatal('interactive staging (-p/-i/-e) is not supported here; stage whole files with git add <file>');
      }
      if (parsed.has('intentToAdd')) {
        return fatal('--intent-to-add is not supported here; stage the file with git add <file>');
      }

      const all = parsed.has('all') || parsed.negated('ignoreRemoval');
      const update = parsed.has('update');
      const force = parsed.has('force');
      const dryRun = parsed.has('dryRun');
      const verbose = parsed.has('verbose') || dryRun;
      if (all && update) return fatal('options \'-A\' and \'-u\' cannot be used together');

      if (parsed.rest.length === 0 && !all && !update) {
        return output('', 'Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\nhint: Disable this message with "git config set advice.addEmptyPathspec false"\n');
      }

      const normalized = normalizePathspecs(cwd, parsed.rest);
      if ('error' in normalized) return normalized.error;
      const specs = normalized.specs.length > 0 ? normalized.specs : ['.'];
      const removeDeleted = !parsed.has('ignoreRemoval') || all || update;

      const status = await readStatus(this.git, this.fs, cwd);
      const tracked = status.filter((s) => s.inIndex);

      // Files that are not ignored, plus ignored ones when forced.
      const worktreeFiles = new Set(status.filter((s) => s.untracked).map((s) => s.path));
      let ignored: string[] = [];
      if (!update) {
        ignored = (await listWorktree(this.fs, cwd)).ignored;
        if (force) for (const path of await expandDirectories(this.fs, cwd, ignored)) worktreeFiles.add(path);
      }

      // Every pathspec has to match something (git checks before touching the index).
      const unmatched: string[] = [];
      const ignoredHits: string[] = [];
      normalized.specs.forEach((spec, i) => {
        const hits = (path: string) => matchesAny(path, spec);
        if (tracked.some((s) => hits(s.path)) || (!update && [...worktreeFiles].some(hits))) return;
        const ignoredHit = (path: string) => path.endsWith('/') ? spec === path.slice(0, -1) || spec.startsWith(path) : hits(path);
        if (!update && !force && !/[*?[]/.test(spec) && ignored.some(ignoredHit)) {
          ignoredHits.push(spec);
          return;
        }
        unmatched.push(parsed.rest[i]);
      });
      if (unmatched.length > 0 && !(dryRun && parsed.has('ignoreMissing'))) {
        return fatal(`pathspec '${unmatched[0]}' did not match any files`);
      }

      const toAdd: string[] = [];
      const toRemove: string[] = [];
      const matches = (path: string) => specs.some((spec) => matchesAny(path, spec));
      for (const s of tracked) {
        if (!matches(s.path)) continue;
        if (s.unstaged === 'M') toAdd.push(s.path);
        else if (s.unstaged === 'D' && removeDeleted) toRemove.push(s.path);
      }
      if (!update) {
        for (const path of worktreeFiles) {
          if (matches(path)) toAdd.push(path);
        }
      }

      const lines = [
        ...toAdd.map((path) => ({ path, text: `add '${path}'` })),
        ...toRemove.map((path) => ({ path, text: `remove '${path}'` })),
      ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

      if (!dryRun) {
        if (toAdd.length > 0) await this.git.add({ dir: cwd, filepath: toAdd.sort(), force: true });
        for (const path of toRemove) await this.git.remove({ dir: cwd, filepath: path });
      }

      const stdout = verbose ? lines.map((l) => `${l.text}\n`).join('') : '';
      if (ignoredHits.length > 0) {
        const paths = ignoredHits.map((spec) => `${spec}\n`).join('');
        return {
          exitCode: 1,
          stdout,
          stderr: `The following paths are ignored by one of your .gitignore files:\n${paths}hint: Use -f if you really want to add them.\nhint: Disable this message with "git config set advice.addIgnoredFile false"\n`,
        };
      }
      return output(stdout);
    } catch (error) {
      return createErrorResult(`git add: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
