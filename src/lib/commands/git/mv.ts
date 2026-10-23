import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { NOT_A_REPO, fatal, isRepo, output, outsideRepository, readIndexSnapshot, repoPath, syncIndexEntry } from "./worktree";

const USAGE = `usage: git mv [-v] [-f] [-n] [-k] <source> <destination>
   or: git mv [-v] [-f] [-n] [-k] <source>... <destination-directory>

    -v, --[no-]verbose    be verbose
    -n, --[no-]dry-run    dry run
    -f, --[no-]force      force move/rename even if target exists
    -k                    skip move/rename errors
`;

interface Move {
  source: string;
  destination: string;
  /** Index entries to move, as [old path, new path]. */
  entries: [string, string][];
}

export class GitMvCommand implements GitSubcommand {
  name = 'mv';
  description = 'Move or rename a file, a directory, or a symlink';
  usage = 'git mv [-v] [-f] [-n] [-k] <source>... <destination>';

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
        flags: { v: 'verbose', verbose: 'verbose', n: 'dryRun', 'dry-run': 'dryRun', f: 'force', force: 'force', k: 'skip', sparse: 'sparse' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      const operands = parsed.rest;
      if (operands.length < 2) return createErrorResult(USAGE, 129);

      const force = parsed.has('force');
      const skip = parsed.has('skip');
      const dryRun = parsed.has('dryRun');
      const verbose = parsed.has('verbose') || dryRun;

      const paths: string[] = [];
      for (const arg of operands) {
        const path = repoPath(cwd, arg);
        if (path === null) return fatal(outsideRepository(arg, cwd));
        paths.push(path);
      }
      const destArg = paths.pop()!;
      const sources = paths;

      const destKind = await this.kind(`${cwd}/${destArg}`);
      const intoDirectory = destKind === 'dir';
      if (sources.length > 1 && !intoDirectory) {
        return fatal(`destination '${operands[operands.length - 1]}' is not a directory`);
      }

      const index = await readIndexSnapshot(this.git, cwd);
      const moves: Move[] = [];
      const targets = new Set<string>();

      for (const source of sources) {
        const base = source.split('/').pop()!;
        const destination = intoDirectory ? (destArg ? `${destArg}/${base}` : base) : destArg;
        const fail = (message: string) => fatal(`${message}, source=${source}, destination=${destination}`);

        const sourceKind = await this.kind(`${cwd}/${source}`);
        let error: string | undefined;
        let entries: [string, string][] = [];

        if (sourceKind === 'none') {
          error = 'bad source';
        } else if (destination === source || destination.startsWith(`${source}/`)) {
          error = sourceKind === 'dir' ? 'can not move directory into itself' : 'bad source';
        } else if (sourceKind === 'dir') {
          entries = [...index.keys()]
            .filter((p) => p.startsWith(`${source}/`))
            .map((p) => [p, `${destination}${p.slice(source.length)}`]);
          if (entries.length === 0) error = 'source directory is empty';
          else if ((await this.kind(`${cwd}/${destination}`)) !== 'none') error = 'destination already exists';
        } else if (!index.has(source)) {
          error = 'not under version control';
        } else {
          entries = [[source, destination]];
          const existing = await this.kind(`${cwd}/${destination}`);
          if (existing === 'dir') error = 'destination already exists';
          else if (existing === 'file' && !force) error = 'destination exists';
        }
        if (!error && targets.has(destination)) error = 'multiple sources for the same target';
        if (!error) {
          const slash = destination.lastIndexOf('/');
          if (slash !== -1 && (await this.kind(`${cwd}/${destination.slice(0, slash)}`)) !== 'dir') {
            if (skip) continue;
            return fatal(`renaming '${source}' failed: No such file or directory`);
          }
        }

        if (error) {
          if (skip) continue;
          return fail(error);
        }
        targets.add(destination);
        moves.push({ source, destination, entries });
      }

      let stdout = '';
      for (const move of moves) {
        if (dryRun) stdout += `Checking rename of '${move.source}' to '${move.destination}'\n`;
        if (verbose) stdout += `Renaming ${move.source} to ${move.destination}\n`;
        if (dryRun) continue;

        if ((await this.kind(`${cwd}/${move.destination}`)) === 'file') await this.fs.unlink(`${cwd}/${move.destination}`);
        await this.fs.rename(`${cwd}/${move.source}`, `${cwd}/${move.destination}`);
        for (const [from, to] of move.entries) {
          const version = index.get(from)!;
          await this.git.remove({ dir: cwd, filepath: from });
          if (index.has(to)) await this.git.remove({ dir: cwd, filepath: to });
          await syncIndexEntry(this.git, this.fs, cwd, to, version);
        }
      }
      return output(stdout);
    } catch (error) {
      return createErrorResult(`git mv: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async kind(path: string): Promise<'file' | 'dir' | 'none'> {
    try {
      return (await this.fs.lstat(path)).isDirectory() ? 'dir' : 'file';
    } catch {
      return 'none';
    }
  }
}
