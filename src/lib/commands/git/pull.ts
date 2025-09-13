import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitPullCommand implements GitSubcommand {
  name = 'pull';
  description = 'Fetch from and integrate with another repository or a local branch';
  usage = 'git pull [<remote>] [<branch>]';

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
      let currentBranch: string | null = null;
      try {
        currentBranch = await git.currentBranch({
          fs,
          dir: cwd,
        }) || null;
        if (!targetBranch) {
          targetBranch = currentBranch || 'main';
        }
      } catch {
        if (!targetBranch) {
          targetBranch = 'main';
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

      // Check for uncommitted changes
      const statusMatrix = await git.statusMatrix({
        fs,
        dir: cwd,
      });

      const hasChanges = statusMatrix.some(([, headStatus, workdirStatus, stageStatus]) => {
        return headStatus !== workdirStatus || headStatus !== stageStatus;
      });

      if (hasChanges) {
        return createErrorResult('error: Your local changes to the following files would be overwritten by merge:\nPlease commit your changes or stash them before you merge.');
      }

      try {
        // Fetch from remote
        await git.fetch({
          fs,
          http,
          dir: cwd,
          remote: remote,
          ref: targetBranch,
          corsProxy: 'https://cors.isomorphic-git.org',
        });

        // Get the remote ref
        const remoteRef = `refs/remotes/${remote}/${targetBranch}`;
        let remoteOid: string;
        try {
          remoteOid = await git.resolveRef({
            fs,
            dir: cwd,
            ref: remoteRef,
          });
        } catch {
          return createErrorResult(`fatal: couldn't find remote ref ${targetBranch}`);
        }

        // Get current HEAD
        let currentOid: string;
        try {
          currentOid = await git.resolveRef({
            fs,
            dir: cwd,
            ref: 'HEAD',
          });
        } catch {
          // Empty repository, just checkout the remote branch
          await git.checkout({
            fs,
            dir: cwd,
            ref: targetBranch,
          });
          return createSuccessResult(`From ${remoteUrl}\n * branch            ${targetBranch}     -> FETCH_HEAD\nUpdating empty repository\nFast-forward\n`);
        }

        // Check if already up to date
        if (currentOid === remoteOid) {
          return createSuccessResult('Already up to date.\n');
        }

        // Perform fast-forward merge (simplified)
        await git.merge({
          fs,
          dir: cwd,
          ours: currentBranch || 'HEAD',
          theirs: remoteRef,
          fastForwardOnly: true,
        });

        return createSuccessResult(`From ${remoteUrl}\n   ${currentOid.substring(0, 7)}..${remoteOid.substring(0, 7)}  ${targetBranch}     -> ${remote}/${targetBranch}\nUpdating ${currentOid.substring(0, 7)}..${remoteOid.substring(0, 7)}\nFast-forward\n`);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('authentication')) {
            return createErrorResult('fatal: Authentication failed. Please configure git credentials.');
          } else if (error.message.includes('network')) {
            return createErrorResult('fatal: unable to access remote repository. Please check your network connection.');
          } else if (error.message.includes('merge conflict')) {
            return createErrorResult('error: Merge conflict detected. Please resolve conflicts manually.');
          } else if (error.message.includes('fast-forward')) {
            return createErrorResult('fatal: Not possible to fast-forward, aborting.');
          }
        }

        return createErrorResult(`Failed to pull: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      return createErrorResult(`git pull: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { remote: string; branch?: string } {
    let remote = 'origin'; // Default remote
    let branch: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (!arg.startsWith('-')) {
        if (remote === 'origin' && !branch) {
          // First non-option argument is remote
          remote = arg;
        } else if (!branch) {
          // Second non-option argument is branch
          branch = arg;
        }
      }
    }

    return { remote, branch };
  }
}