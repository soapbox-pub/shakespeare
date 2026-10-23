import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { abbrev, resolveRevision, RevisionError, upstreamRef } from "./revisions";

export class GitRevParseCommand implements GitSubcommand {
  name = 'rev-parse';
  description = 'Pick out and massage parameters';
  usage = 'git rev-parse [--verify] [-q] [--short[=<n>]] [--abbrev-ref] [--symbolic-full-name] [--show-toplevel] [--git-dir] [--is-inside-work-tree] <rev>...';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    let inRepo = true;
    try {
      await this.fs.stat(`${cwd}/.git`);
    } catch {
      inRepo = false;
    }
    const notRepo = 'fatal: not a git repository (or any of the parent directories): .git';

    let short: number | undefined;
    let abbrevRef = false;
    let symbolicFullName = false;
    let verify = false;
    let quiet = false;
    let afterDashDash = false;
    const outputs: string[] = [];
    const revs: string[] = [];

    const resolveArg = async (rev: string): Promise<ShellCommandResult | undefined> => {
      const negate = rev.startsWith('^') && !rev.startsWith('^{');
      const spec = negate ? rev.slice(1) : rev;
      try {
        if (rev.includes('..')) {
          const symmetric = rev.includes('...');
          const [a, b] = rev.split(symmetric ? '...' : '..');
          const right = await resolveRevision(this.git, cwd, b || 'HEAD');
          const left = await resolveRevision(this.git, cwd, a || 'HEAD');
          outputs.push(this.shorten(right, short));
          if (symmetric) {
            outputs.push(this.shorten(left, short));
            for (const base of await this.git.findMergeBase({ dir: cwd, oids: [left, right] })) {
              outputs.push(`^${this.shorten(base, short)}`);
            }
          } else {
            outputs.push(`^${this.shorten(left, short)}`);
          }
        } else if (abbrevRef || symbolicFullName) {
          const name = await this.symbolicName(cwd, spec);
          outputs.push(abbrevRef ? this.abbreviateRef(name) : name);
        } else {
          const oid = await resolveRevision(this.git, cwd, spec);
          outputs.push(`${negate ? '^' : ''}${this.shorten(oid, short)}`);
        }
        return undefined;
      } catch (error) {
        if (verify) {
          return quiet ? { exitCode: 1, stdout: '', stderr: '' } : createErrorResult('fatal: Needed a single revision');
        }
        if (error instanceof RevisionError) {
          // git prints what it resolved, then the argument it couldn't.
          return {
            exitCode: 128,
            stdout: [...outputs, rev].join('\n') + '\n',
            stderr: `${error.message}\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'`,
          };
        }
        return createErrorResult(`fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    for (const arg of args) {
      if (afterDashDash) {
        outputs.push(arg);
        continue;
      }
      switch (arg) {
        case '--':
          afterDashDash = true;
          continue;
        case '--short':
          short = 7;
          continue;
        case '--abbrev-ref':
          abbrevRef = true;
          continue;
        case '--symbolic-full-name':
          symbolicFullName = true;
          continue;
        case '--verify':
          verify = true;
          continue;
        case '-q':
        case '--quiet':
          quiet = true;
          continue;
        case '--show-toplevel':
          if (!inRepo) return createErrorResult(notRepo);
          outputs.push(cwd);
          continue;
        case '--git-dir':
          if (!inRepo) return createErrorResult(notRepo);
          outputs.push('.git');
          continue;
        case '--absolute-git-dir':
        case '--git-common-dir':
          if (!inRepo) return createErrorResult(notRepo);
          outputs.push(arg === '--git-common-dir' ? '.git' : `${cwd}/.git`);
          continue;
        case '--is-inside-work-tree':
          if (!inRepo) return createErrorResult(notRepo);
          outputs.push('true');
          continue;
        case '--is-inside-git-dir':
        case '--is-bare-repository':
        case '--is-shallow-repository':
          if (!inRepo) return createErrorResult(notRepo);
          outputs.push('false');
          continue;
        case '--show-prefix':
        case '--show-cdup':
          if (!inRepo) return createErrorResult(notRepo);
          outputs.push('');
          continue;
        case '--local-env-vars':
          continue;
      }
      if (arg.startsWith('--short=')) {
        short = Math.max(4, parseInt(arg.slice(8), 10) || 7);
      } else if (arg.startsWith('--default') || arg === '--revs-only' || arg === '--no-flags') {
        // Accepted, no effect.
      } else if (arg.startsWith('-') && !arg.startsWith('^')) {
        // git prints unknown options back unchanged.
        if (!verify) outputs.push(arg);
      } else {
        if (!inRepo) return createErrorResult(notRepo);
        revs.push(arg);
        if (verify && revs.length > 1) break;
        const failed = await resolveArg(arg);
        if (failed) return failed;
      }
    }

    if (verify && revs.length !== 1) {
      return quiet ? { exitCode: 1, stdout: '', stderr: '' } : createErrorResult('fatal: Needed a single revision');
    }

    if (outputs.length === 0) return createSuccessResult('');
    return createSuccessResult(outputs.join('\n') + '\n');
  }

  private shorten(oid: string, short: number | undefined): string {
    return short ? abbrev(oid, short) : oid;
  }

  /** The full ref name a revision refers to (`refs/heads/main`), or the revision itself for object ids. */
  private async symbolicName(cwd: string, spec: string): Promise<string> {
    const upstream = spec.match(/^(.*)@\{(?:u|upstream|push)\}$/i);
    if (upstream) {
      const ref = await upstreamRef(this.git, cwd, upstream[1] === '@' ? undefined : upstream[1] || undefined);
      if (!ref) throw new RevisionError(`fatal: no upstream configured for branch '${upstream[1] || (await this.git.currentBranch({ dir: cwd })) || 'HEAD'}'`);
      return ref;
    }
    if (spec === 'HEAD' || spec === '@') {
      const branch = await this.git.currentBranch({ dir: cwd, fullname: true });
      if (branch) return branch;
      await resolveRevision(this.git, cwd, 'HEAD');
      return 'HEAD';
    }
    try {
      return await this.git.expandRef({ dir: cwd, ref: spec });
    } catch {
      // An object id or expression: git prints nothing useful for these; echo the oid.
      await resolveRevision(this.git, cwd, spec);
      return spec;
    }
  }

  private abbreviateRef(name: string): string {
    return name.replace(/^refs\/(heads|tags|remotes)\//, '');
  }
}
