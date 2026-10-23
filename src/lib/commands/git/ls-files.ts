import ignore from 'ignore';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { matchesPathspec, readIndex } from "./revisions";
import {
  NOT_A_REPO, collapseUntracked, expandDirectories, fatal, isRepo, listWorktree, matchesAny, normalizePathspecs, output,
  readStatus,
} from "./worktree";

export class GitLsFilesCommand implements GitSubcommand {
  name = 'ls-files';
  description = 'Show information about files in the index and the working tree';
  usage = 'git ls-files [<options>] [<file>...]';

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
          c: 'cached', cached: 'cached', d: 'deleted', deleted: 'deleted', m: 'modified', modified: 'modified',
          o: 'others', others: 'others', i: 'ignored', ignored: 'ignored', s: 'stage', stage: 'stage',
          u: 'unmerged', unmerged: 'unmerged', k: 'killed', killed: 'killed', z: 'z', t: 't', v: 't', f: 'f',
          'exclude-standard': 'excludeStandard', directory: 'directory', 'empty-directory': 'emptyDirectory',
          'error-unmatch': 'errorUnmatch', 'full-name': 'fullName', deduplicate: 'deduplicate', debug: 'debug',
          recurse_submodules: 'recurseSubmodules', 'recurse-submodules': 'recurseSubmodules', eol: 'eol', sparse: 'sparse',
        },
        values: {
          x: 'exclude', exclude: 'exclude', X: 'excludeFrom', 'exclude-from': 'excludeFrom',
          'exclude-per-directory': 'excludePerDirectory', 'with-tree': 'withTree', format: 'format',
        },
        optional: { abbrev: 'abbrev' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }

      const normalized = normalizePathspecs(cwd, parsed.rest);
      if ('error' in normalized) return normalized.error;
      const specs = normalized.specs;
      const matches = (path: string) => matchesPathspec(path, specs);

      const showOthers = parsed.has('others');
      const showDeleted = parsed.has('deleted');
      const showModified = parsed.has('modified');
      const showStage = parsed.has('stage') || parsed.has('unmerged');
      const showCached = parsed.has('cached') || showStage || (!showOthers && !showDeleted && !showModified && !parsed.has('killed') && !parsed.has('ignored'));
      const tags = parsed.has('t');
      const end = parsed.has('z') ? '\0' : '\n';
      const format = parsed.get('format');
      const abbrevLength = parsed.get('abbrev') ? parseInt(parsed.get('abbrev')!, 10) : parsed.has('abbrev') ? 7 : 40;

      if (parsed.has('ignored') && !showOthers && !showCached) {
        return fatal('ls-files -i must be used with either -o or -c');
      }

      const index = await readIndex(this.git, cwd);
      let out = '';

      if (showOthers) {
        const listing = await listWorktree(this.fs, cwd);
        const extra = ignore();
        for (const pattern of parsed.getAll('exclude')) extra.add(pattern);
        for (const file of parsed.getAll('excludeFrom')) {
          try {
            extra.add(await this.fs.readFile(file.startsWith('/') ? file : `${cwd}/${file}`, 'utf8'));
          } catch {
            return fatal(`cannot use ${file} as an exclude file`);
          }
        }
        const useStandard = parsed.has('excludeStandard') || parsed.has('excludePerDirectory');
        const explicitlyIgnored = (path: string) => extra.ignores(path);

        let files: string[];
        if (parsed.has('ignored')) {
          const ignored = useStandard ? await expandDirectories(this.fs, cwd, listing.ignored) : [];
          const all = useStandard ? [] : [...listing.files, ...await expandDirectories(this.fs, cwd, listing.ignored)];
          files = [...ignored, ...all.filter(explicitlyIgnored)];
        } else if (useStandard) {
          files = listing.files.filter((p) => !explicitlyIgnored(p));
        } else {
          files = [...listing.files, ...await expandDirectories(this.fs, cwd, listing.ignored)].filter((p) => !explicitlyIgnored(p));
        }
        files = files.filter((p) => !index.has(p) && matches(p)).sort();
        if (parsed.has('directory')) files = collapseUntracked(files, index.keys());
        for (const path of files) out += `${tags ? '? ' : ''}${path}${end}`;
      }

      if (showCached || showDeleted || showModified) {
        const status = new Map((showDeleted || showModified ? await readStatus(this.git, this.fs, cwd) : []).map((s) => [s.path, s]));
        const paths = [...index.keys()].filter(matches).sort();
        for (const path of paths) {
          const entry = index.get(path)!;
          const s = status.get(path);
          if (showCached && !(parsed.has('ignored') && !showOthers)) {
            if (format) {
              out += `${this.expandFormat(format, entry.mode, entry.oid, path, abbrevLength)}${end}`;
            } else if (showStage) {
              out += `${tags ? 'H ' : ''}${entry.mode} ${entry.oid.slice(0, abbrevLength)} 0\t${path}${end}`;
            } else {
              out += `${tags ? 'H ' : ''}${path}${end}`;
            }
          }
          if (showDeleted && s?.unstaged === 'D') out += `${tags ? 'R ' : ''}${path}${end}`;
          if (showModified && s && s.unstaged !== ' ') out += `${tags ? 'C ' : ''}${path}${end}`;
        }
      }

      if (parsed.has('errorUnmatch')) {
        const known = [...index.keys()];
        for (let i = 0; i < specs.length; i++) {
          if (!known.some((p) => matchesAny(p, specs[i]))) {
            return {
              exitCode: 1,
              stdout: out,
              stderr: `error: pathspec '${parsed.rest[i]}' did not match any file(s) known to git\nDid you forget to 'git add'?\n`,
            };
          }
        }
      }

      return output(out);
    } catch (error) {
      return createErrorResult(`git ls-files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private expandFormat(format: string, mode: string, oid: string, path: string, abbrevLength: number): string {
    return format.replace(/%\((objectmode|objectname|objecttype|stage|path)\)|%x([0-9a-fA-F]{2})|%n|%%/g, (match, field: string | undefined, hex: string | undefined) => {
      if (hex) return String.fromCharCode(parseInt(hex, 16));
      if (match === '%n') return '\n';
      if (match === '%%') return '%';
      switch (field) {
        case 'objectmode': return mode;
        case 'objectname': return oid.slice(0, abbrevLength);
        case 'objecttype': return mode === '160000' ? 'commit' : 'blob';
        case 'stage': return '0';
        default: return path;
      }
    });
  }
}
