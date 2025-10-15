import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitCommitCommand implements GitSubcommand {
  name = 'commit';
  description = 'Record changes to the repository';
  usage = 'git commit [-m <msg>] [-a | --all] [-am <msg>] [--amend] [--allow-empty]';

  private git: Git;
  private fs: JSRuntimeFS;
  private pwd: string;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
    this.pwd = options.pwd;
  }

  async execute(args: string[]): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await this.fs.stat(`${this.pwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { options, message } = this.parseArgs(args);

      if (!message && !options.amend) {
        return createErrorResult('Aborting commit due to empty commit message.');
      }
      
      // If -a flag is provided, stage all tracked files with modifications
      if (options.addAll) {
        await this.stageTrackedChanges();
      }

      // Get current status
      const statusMatrix = await this.git.statusMatrix({
        dir: this.pwd,
      });

      // Check for staged changes
      const stagedFiles = statusMatrix.filter(([, headStatus, , stageStatus]) => {
        return headStatus !== stageStatus;
      });

      if (stagedFiles.length === 0 && !options.allowEmpty && !options.amend) {
        return createErrorResult('nothing to commit, working tree clean');
      }

      let commitMessage = message;
      if (options.amend) {
        // Get the last commit message if amending
        try {
          const commits = await this.git.log({

            dir: this.pwd,
            depth: 1,
          });
          if (commits.length > 0 && !message) {
            commitMessage = commits[0].commit.message;
          }
        } catch {
          // If we can't get the last commit, use the provided message or default
          if (!commitMessage) {
            commitMessage = 'Amended commit';
          }
        }
      }

      // Get current branch
      let currentBranch = 'main';
      try {
        currentBranch = await this.git.currentBranch({

          dir: this.pwd,
        }) || 'main';
      } catch {
        // Use default
      }

      // Create the commit
      const commitOptions: {
        dir: string;
        message: string;
        parent?: string[];
      } = {
        dir: this.pwd,
        message: commitMessage || 'Empty commit',
      };

      if (options.amend) {
        // For amend, we need to reset to the parent of the current commit
        try {
          const commits = await this.git.log({
            dir: this.pwd,
            depth: 2,
          });
          if (commits.length > 1) {
            commitOptions.parent = [commits[1].oid];
          }
        } catch {
          // If we can't get parent, proceed without amending
        }
      }

      const commitSha = await this.git.commit(commitOptions);

      // Get short hash
      const shortHash = commitSha.substring(0, 7);

      // Count changes
      const addedFiles = stagedFiles.filter(([, headStatus, , stageStatus]) =>
        headStatus === 0 && stageStatus === 1
      ).length;

      const modifiedFiles = stagedFiles.filter(([, headStatus, , stageStatus]) =>
        headStatus === 1 && stageStatus === 1
      ).length;

      const deletedFiles = stagedFiles.filter(([, headStatus, , stageStatus]) =>
        headStatus === 1 && stageStatus === 0
      ).length;

      const totalFiles = stagedFiles.length;

      let result = `[${currentBranch} ${shortHash}] ${commitMessage}\n`;

      if (totalFiles > 0) {
        const changes: string[] = [];
        if (addedFiles > 0) changes.push(`${addedFiles} file${addedFiles !== 1 ? 's' : ''} added`);
        if (modifiedFiles > 0) changes.push(`${modifiedFiles} file${modifiedFiles !== 1 ? 's' : ''} changed`);
        if (deletedFiles > 0) changes.push(`${deletedFiles} file${deletedFiles !== 1 ? 's' : ''} deleted`);

        result += ` ${changes.join(', ')}\n`;
      }

      return createSuccessResult(result);

    } catch (error) {
      return createErrorResult(`git commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stage all tracked files with modifications
   * This is used when the -a flag is provided
   */
  private async stageTrackedChanges(): Promise<void> {
    try {
      // Get the status matrix
      const statusMatrix = await this.git.statusMatrix({
        dir: this.pwd,
      });

      // Process each file based on its status
      for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
        // Only process tracked files (headStatus === 1) with changes
        if (headStatus === 1 && workdirStatus !== headStatus) {
          if (workdirStatus === 0) {
            // File was deleted, use remove
            await this.git.remove({
              dir: this.pwd,
              filepath,
            });
          } else {
            // File was modified, use add
            await this.git.add({
              dir: this.pwd,
              filepath,
            });
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to stage tracked changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    options: { amend: boolean; allowEmpty: boolean; addAll: boolean };
    message?: string
  } {
    const options = { amend: false, allowEmpty: false, addAll: false };
    let message: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-m' || arg === '--message') {
        if (i + 1 < args.length) {
          message = args[i + 1];
          i++; // Skip next argument as it's the message
        }
      } else if (arg.startsWith('-m=')) {
        message = arg.substring(3);
      } else if (arg.startsWith('--message=')) {
        message = arg.substring(10);
      } else if (arg === '--amend') {
        options.amend = true;
      } else if (arg === '--allow-empty') {
        options.allowEmpty = true;
      } else if (arg === '-a' || arg === '--all') {
        options.addAll = true;
      } else if (arg === '-am') {
        options.addAll = true;
        if (i + 1 < args.length) {
          message = args[i + 1];
          i++; // Skip next argument as it's the message
        }
      }
    }

    return { options, message };
  }
}