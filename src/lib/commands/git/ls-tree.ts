import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { abbrev, matchesPathspec, resolveTree, RevisionError } from "./revisions";

interface Entry {
  path: string;
  mode: string;
  type: string;
  oid: string;
}

export class GitLsTreeCommand implements GitSubcommand {
  name = 'ls-tree';
  description = 'List the contents of a tree object';
  usage = 'git ls-tree [-d] [-r] [-t] [-l] [-z] [--name-only] [--abbrev[=<n>]] [--full-tree] <tree-ish> [<path>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      await this.fs.stat(`${cwd}/.git`);
    } catch {
      return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
    }

    const parsed = parseArgs(args, {
      flags: {
        r: 'recursive', d: 'dirsOnly', t: 'showTrees', l: 'long', long: 'long', z: 'nul',
        'name-only': 'nameOnly', 'name-status': 'nameOnly', 'object-only': 'objectOnly', 'full-tree': 'fullTree', 'full-name': 'fullName',
      },
      optional: { abbrev: 'abbrev' },
    });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage));

    const [spec, ...paths] = parsed.rest;
    if (!spec) return createErrorResult(`usage: ${this.usage}`);

    let treeOid: string;
    try {
      treeOid = await resolveTree(this.git, cwd, spec);
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(`fatal: Not a valid object name ${spec}`);
      throw error;
    }

    const recursive = parsed.has('recursive') && !parsed.has('dirsOnly');
    const specs = paths.map((p) => ({ path: p.replace(/^\.\//, '').replace(/\/+$/, ''), dir: p.endsWith('/') }));

    // Without -r, `dir` lists the directory itself and `dir/` lists its contents.
    const action = (path: string, isTree: boolean): 'show' | 'descend' | 'skip' => {
      if (specs.length === 0) return isTree && recursive ? 'descend' : 'show';
      for (const spec of specs) {
        if (path === spec.path) return isTree && (recursive || spec.dir) ? 'descend' : 'show';
        if (path.startsWith(`${spec.path}/`)) return isTree && recursive ? 'descend' : 'show';
        if (isTree && spec.path.startsWith(`${path}/`)) return 'descend';
        if (/[*?[]/.test(spec.path) && matchesPathspec(path, [spec.path])) return isTree && recursive ? 'descend' : 'show';
      }
      return 'skip';
    };

    const entries: Entry[] = [];
    const walk = async (oid: string, prefix: string): Promise<void> => {
      const { tree } = await this.git.readTree({ dir: cwd, oid });
      for (const e of tree) {
        const path = prefix ? `${prefix}/${e.path}` : e.path;
        const entry = { path, mode: e.mode.padStart(6, '0'), type: e.type, oid: e.oid };
        const isTree = e.type === 'tree';
        const what = action(path, isTree);
        if (what === 'descend') {
          if (parsed.has('showTrees')) entries.push(entry);
          await walk(e.oid, path);
        } else if (what === 'show' && (!parsed.has('dirsOnly') || isTree)) {
          entries.push(entry);
        }
      }
    };
    await walk(treeOid, '');

    const length = parsed.get('abbrev') ? parseInt(parsed.get('abbrev')!, 10) : parsed.has('abbrev') ? 7 : 40;
    const end = parsed.has('nul') ? '\0' : '\n';
    const sizes = parsed.has('long') ? await Promise.all(entries.map(async (e) => {
      if (e.type !== 'blob') return '-';
      const { blob } = await this.git.readBlob({ dir: cwd, oid: e.oid });
      return String(blob.length);
    })) : [];
    const sizeWidth = Math.max(7, ...sizes.map((s) => s.length));

    const out = entries.map((e, i) => {
      if (parsed.has('nameOnly')) return e.path + end;
      if (parsed.has('objectOnly')) return abbrev(e.oid, length) + end;
      const size = parsed.has('long') ? ` ${sizes[i].padStart(sizeWidth)}` : '';
      return `${e.mode} ${e.type} ${abbrev(e.oid, length)}${size}\t${e.path}${end}`;
    }).join('');
    return createSuccessResult(out);
  }
}
