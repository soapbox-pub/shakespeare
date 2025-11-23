import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitPullCommand implements GitSubcommand {
  name = 'pull';
  description = 'Fetch from and integrate with another repository or a local branch';
  usage = 'git pull [<remote>] [<branch>]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { remote, branch } = this.parseArgs(args);

      // Get current branch if not specified
      let targetBranch = branch;
      let currentBranch: string | null = null;
      try {
        currentBranch = await this.git.currentBranch({
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
        const remotes = await this.git.listRemotes({
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
      const statusMatrix = await this.git.statusMatrix({
        dir: cwd,
      });

      const modifiedFiles = statusMatrix
        .filter(([, headStatus, workdirStatus, stageStatus]) => {
          // Check for any uncommitted changes (modified, staged, or untracked)
          return headStatus !== workdirStatus || headStatus !== stageStatus;
        })
        .map(([filepath]) => filepath);

      if (modifiedFiles.length > 0) {
        const fileList = modifiedFiles.map(file => `\t${file}`).join('\n');
        return createErrorResult(`error: Your local changes to the following files would be overwritten by merge:\n${fileList}\nPlease commit your changes or stash them before you merge.`);
      }

      try {
        // Fetch from remote
        await this.git.fetch({
          dir: cwd,
          remote: remote,
          ref: targetBranch,
        });

        // Get the remote ref
        const remoteRef = `refs/remotes/${remote}/${targetBranch}`;
        let remoteOid: string;
        try {
          remoteOid = await this.git.resolveRef({
            dir: cwd,
            ref: remoteRef,
          });
        } catch {
          return createErrorResult(`fatal: couldn't find remote ref ${targetBranch}`);
        }

        // Get current HEAD
        let currentOid: string;
        try {
          currentOid = await this.git.resolveRef({
            dir: cwd,
            ref: 'HEAD',
          });
        } catch {
          // Empty repository, just checkout the remote branch
          await this.git.checkout({
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
        await this.git.merge({
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

    const nonOptionArgs = args.filter(arg => !arg.startsWith('-'));

    if (nonOptionArgs.length >= 1) {
      remote = nonOptionArgs[0];
    }
    if (nonOptionArgs.length >= 2) {
      branch = nonOptionArgs[1];
    }

    return { remote, branch };
  }
}
