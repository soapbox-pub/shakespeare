import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { resolveCommit, RevisionError } from "./revisions";
import { createAndSwitch, detachAt, guessRemoteBranch, orphan, resolvePrevious, switchToBranch, type SwitchContext } from "./checkout";
import { NOT_A_REPO, branchExists, fatal, isRepo } from "./worktree";

export class GitSwitchCommand implements GitSubcommand {
  name = 'switch';
  description = 'Switch branches';
  usage = 'git switch [<options>] [<branch>]';

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
          q: 'quiet', quiet: 'quiet', f: 'force', force: 'force', 'discard-changes': 'force',
          d: 'detach', detach: 'detach', m: 'merge', merge: 'merge', t: 'track', track: 'track',
          guess: 'guess', progress: 'progress', 'ignore-other-worktrees': 'ignoreOtherWorktrees',
        },
        values: { c: 'create', create: 'create', C: 'reset', 'force-create': 'reset', orphan: 'orphan', conflict: 'conflict' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }

      const ctx: SwitchContext = { git: this.git, fs: this.fs, dir: cwd, force: parsed.has('force'), quiet: parsed.has('quiet') };
      const positionals = [...parsed.rest];
      if (positionals[0] === '-') {
        const previous = await resolvePrevious(this.fs, cwd);
        if (!previous) return fatal('invalid reference: @{-1}');
        positionals[0] = previous;
        if (!(await branchExists(this.git, cwd, previous))) {
          return await this.detach(ctx, previous);
        }
      }

      const createName = parsed.get('reset') ?? parsed.get('create');
      if (createName !== undefined) {
        if (positionals.length > 1) return fatal(`'${positionals[1]}' is not a commit and a branch '${createName}' cannot be created from it`);
        if (positionals[0] !== undefined) {
          try {
            await resolveCommit(this.git, cwd, positionals[0]);
          } catch {
            return fatal(`invalid reference: ${positionals[0]}`);
          }
        }
        return await createAndSwitch(ctx, createName, positionals[0], { reset: parsed.has('reset'), noTrack: parsed.negated('track') });
      }

      const orphanName = parsed.get('orphan');
      if (orphanName !== undefined) return await orphan(ctx, orphanName);

      if (parsed.has('detach')) return await this.detach(ctx, positionals[0] ?? 'HEAD');

      if (positionals.length === 0) return fatal('missing branch or commit argument');
      if (positionals.length > 1) return fatal(`only one reference expected, ${positionals.length} given.`);

      const name = positionals[0];
      if (await branchExists(this.git, cwd, name)) return await switchToBranch(ctx, name);

      if (!parsed.negated('guess')) {
        const remote = await guessRemoteBranch(this.git, cwd, name);
        if (remote) return await createAndSwitch(ctx, name, remote, { reset: false });
      }

      return await this.notABranch(cwd, name);
    } catch (error) {
      if (error instanceof RevisionError) return fatal(error.message);
      return createErrorResult(`git switch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async detach(ctx: SwitchContext, spec: string): Promise<ShellCommandResult> {
    let oid: string;
    try {
      oid = await resolveCommit(this.git, ctx.dir, spec);
    } catch {
      return fatal(`invalid reference: ${spec}`);
    }
    return detachAt(ctx, spec, oid, false);
  }

  private async notABranch(dir: string, name: string): Promise<ShellCommandResult> {
    const hint = '\nhint: If you want to detach HEAD at the commit, try again with the --detach option.';
    const isRef = async (ref: string) => {
      try {
        await this.git.resolveRef({ dir, ref });
        return true;
      } catch {
        return false;
      }
    };
    if (await isRef(`refs/tags/${name}`)) return fatal(`a branch is expected, got tag '${name}'${hint}`);
    if (await isRef(`refs/remotes/${name}`)) return fatal(`a branch is expected, got remote branch '${name}'${hint}`);
    try {
      await resolveCommit(this.git, dir, name);
      return fatal(`a branch is expected, got commit '${name}'${hint}`);
    } catch {
      return fatal(`invalid reference: ${name}`);
    }
  }
}
