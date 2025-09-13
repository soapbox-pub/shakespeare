import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitPushCommand implements GitSubcommand {
  name = 'push';
  description = 'Update remote refs along with associated objects';
  usage = 'git push [<remote>] [<branch>]';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { remote, branch } = this.parseArgs(args);

      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        try {
          targetBranch = await git.currentBranch({
            fs,
            dir: cwd,
          }) || undefined;
          if (!targetBranch) {
            return createErrorResult('fatal: You are not currently on a branch.');
          }
        } catch {
          return createErrorResult('fatal: You are not currently on a branch.');
        }
      }

      // Get remote URL
      let remoteUrl: string;
      try {
        const remotes = await git.listRemotes({
          fs,
          dir: cwd,
        });

        const targetRemote = remotes.find(r => r.remote === remote);
        if (!targetRemote) {
          return createErrorResult(`fatal: '${remote}' does not appear to be a git repository`);
        }
        remoteUrl = targetRemote.url;
      } catch {
        return createErrorResult(`fatal: '${remote}' does not appear to be a git repository`);
      }

      try {
        await git.push({
          fs,
          http,
          dir: cwd,
          remote: remote,
          ref: targetBranch,
          remoteRef: targetBranch,
          corsProxy: 'https://cors.isomorphic-git.org',
        });

        return createSuccessResult(`To ${remoteUrl}\n   ${targetBranch} -> ${targetBranch}\n`);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('authentication')) {
            return createErrorResult('fatal: Authentication failed. Please configure git credentials.');
          } else if (error.message.includes('rejected')) {
            return createErrorResult(`error: failed to push some refs to '${remoteUrl}'\nhint: Updates were rejected because the remote contains work that you do not have locally.`);
          } else if (error.message.includes('network')) {
            return createErrorResult('fatal: unable to access remote repository. Please check your network connection.');
          }
        }

        return createErrorResult(`Failed to push: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      return createErrorResult(`git push: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    remote: string;
    branch?: string;
    options: { force: boolean; setUpstream: boolean }
  } {
    const options = { force: false, setUpstream: false };
    let remote = 'origin'; // Default remote
    let branch: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--force' || arg === '-f') {
        options.force = true;
      } else if (arg === '--set-upstream' || arg === '-u') {
        options.setUpstream = true;
      } else if (!arg.startsWith('-')) {
        if (remote === 'origin' && !branch) {
          // First non-option argument is remote
          remote = arg;
        } else if (!branch) {
          // Second non-option argument is branch
          branch = arg;
        }
      }
    }

    return { remote, branch, options };
  }
}