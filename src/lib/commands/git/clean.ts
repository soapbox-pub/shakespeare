import ignore from "ignore";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { matchesPathspec, readIndex } from "./revisions";

interface CleanOptions {
  dirs: boolean;
  /** Don't use the standard ignore rules (`-x`). */
  noStandardIgnore: boolean;
  /** Remove only ignored files (`-X`). */
  onlyIgnored: boolean;
  /** `-ff`: also remove nested repositories. */
  nested: boolean;
  pathspecs: string[];
  extra: ReturnType<typeof ignore>;
}

/** `git clean`: remove untracked files from the working tree. */
export class GitCleanCommand implements GitSubcommand {
  name = 'clean';
  description = 'Remove untracked files from the working tree';
  usage = 'git clean [-d] [-f] [-i] [-n] [-q] [-e <pattern>] [-x | -X] [--] [<pathspec>...]';

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

      const parsed = parseArgs(args, {
        flags: {
          d: 'dirs', f: 'force', force: 'force', n: 'dryRun', 'dry-run': 'dryRun', q: 'quiet', quiet: 'quiet',
          x: 'x', X: 'X', i: 'interactive', interactive: 'interactive',
        },
        values: { e: 'exclude', exclude: 'exclude' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('interactive')) {
        return createErrorResult('error: interactive clean is not supported here; use -n to preview and -f to remove', 1);
      }
      if (parsed.has('x') && parsed.has('X')) {
        return createErrorResult("fatal: options '-x' and '-X' cannot be used together", 128);
      }

      const forceCount = args.filter((a) => /^-[a-zA-Z]*f/.test(a) && !a.startsWith('--')).reduce((n, a) => n + (a.match(/f/g)?.length ?? 0), 0) +
        args.filter((a) => a === '--force').length;
      const dryRun = parsed.has('dryRun');
      if (!dryRun && forceCount === 0) {
        const requireForce = await this.git.getConfig({ dir: cwd, path: 'clean.requireForce' });
        if (requireForce !== false && requireForce !== 'false') {
          return createErrorResult('fatal: clean.requireForce defaults to true and neither -i, -n, nor -f given; refusing to clean', 128);
        }
      }

      const options: CleanOptions = {
        dirs: parsed.has('dirs'),
        noStandardIgnore: parsed.has('x'),
        onlyIgnored: parsed.has('X'),
        nested: forceCount > 1,
        pathspecs: parsed.rest.map((p) => p.replace(/^\.\//, '').replace(/\/+$/, '')).filter((p) => p !== '' && p !== '.'),
        extra: ignore().add(parsed.getAll('exclude')),
      };

      const tracked = new Set((await readIndex(this.git, cwd)).keys());
      const trackedDirs = new Set<string>();
      for (const path of tracked) {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) trackedDirs.add(parts.slice(0, i).join('/'));
      }

      const victims: Array<{ path: string; dir: boolean }> = [];
      await this.walk(cwd, '', options, tracked, trackedDirs, victims);
      victims.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

      let out = '';
      let errors = '';
      for (const { path, dir } of victims) {
        const display = dir ? `${path}/` : path;
        if (dryRun) {
          out += `Would remove ${display}\n`;
          continue;
        }
        try {
          if (dir) await this.removeTree(`${cwd}/${path}`);
          else await this.fs.unlink(`${cwd}/${path}`);
          if (!parsed.has('quiet')) out += `Removing ${display}\n`;
        } catch (error) {
          errors += `warning: failed to remove ${display}: ${error instanceof Error ? error.message : 'unknown error'}\n`;
        }
      }
      return { exitCode: errors ? 1 : 0, stdout: out, stderr: errors };
    } catch (error) {
      return createErrorResult(`git clean: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async isIgnored(cwd: string, path: string, dir: boolean, options: CleanOptions): Promise<boolean> {
    const rel = dir ? `${path}/` : path;
    if (options.extra.ignores(rel)) return true;
    if (options.noStandardIgnore) return false;
    try {
      return await this.git.isIgnored({ dir: cwd, filepath: rel });
    } catch {
      return false;
    }
  }

  /** Whether a pathspec selects `path`, or something inside it (for directories). */
  private selection(path: string, dir: boolean, pathspecs: string[]): 'all' | 'inside' | 'none' {
    if (matchesPathspec(path, pathspecs)) return 'all';
    if (dir && pathspecs.some((p) => p.startsWith(`${path}/`) || /[*?[]/.test(p))) return 'inside';
    return 'none';
  }

  private async walk(
    cwd: string,
    prefix: string,
    options: CleanOptions,
    tracked: Set<string>,
    trackedDirs: Set<string>,
    victims: Array<{ path: string; dir: boolean }>,
  ): Promise<void> {
    let names: string[];
    try {
      names = await this.fs.readdir(prefix ? `${cwd}/${prefix}` : cwd);
    } catch {
      return;
    }

    for (const name of names) {
      if (name === '.git') continue;
      const path = prefix ? `${prefix}/${name}` : name;
      let isDir = false;
      try {
        isDir = (await this.fs.lstat(`${cwd}/${path}`)).isDirectory();
      } catch {
        continue;
      }

      if (!isDir) {
        if (tracked.has(path) || this.selection(path, false, options.pathspecs) === 'none') continue;
        const ignored = await this.isIgnored(cwd, path, false, options);
        if (options.onlyIgnored ? ignored : !ignored) victims.push({ path, dir: false });
        continue;
      }

      const selected = this.selection(path, true, options.pathspecs);
      if (selected === 'none') continue;
      if (trackedDirs.has(path) || selected === 'inside') {
        await this.walk(cwd, path, options, tracked, trackedDirs, victims);
        continue;
      }

      // An untracked directory.
      if (!options.nested && await this.exists(`${cwd}/${path}/.git`)) continue;
      const ignored = await this.isIgnored(cwd, path, true, options);
      if (!options.dirs) {
        // Without -d, only look inside for ignored files (-X) or when a pathspec names it.
        if (!ignored && (options.onlyIgnored || options.pathspecs.length > 0)) {
          await this.walk(cwd, path, options, tracked, trackedDirs, victims);
        }
        continue;
      }
      if (options.onlyIgnored) {
        if (ignored) victims.push({ path, dir: true });
        else await this.walk(cwd, path, options, tracked, trackedDirs, victims);
      } else if (!ignored) {
        // Keep ignored files inside it, unless -x.
        if (await this.containsIgnored(cwd, path, options)) {
          await this.walk(cwd, path, options, tracked, trackedDirs, victims);
        } else {
          victims.push({ path, dir: true });
        }
      }
    }
  }

  private async containsIgnored(cwd: string, dir: string, options: CleanOptions): Promise<boolean> {
    let names: string[];
    try {
      names = await this.fs.readdir(`${cwd}/${dir}`);
    } catch {
      return false;
    }
    for (const name of names) {
      const path = `${dir}/${name}`;
      const isDir = (await this.fs.lstat(`${cwd}/${path}`)).isDirectory();
      if (await this.isIgnored(cwd, path, isDir, options)) return true;
      if (isDir && await this.containsIgnored(cwd, path, options)) return true;
    }
    return false;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await this.fs.lstat(path);
      return true;
    } catch {
      return false;
    }
  }

  private async removeTree(path: string): Promise<void> {
    const stat = await this.fs.lstat(path);
    if (!stat.isDirectory()) {
      await this.fs.unlink(path);
      return;
    }
    for (const name of await this.fs.readdir(path)) {
      await this.removeTree(`${path}/${name}`);
    }
    await this.fs.rmdir(path);
  }
}
