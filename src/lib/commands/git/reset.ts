
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitResetCommand implements GitSubcommand {
  name = 'reset';
  description = 'Reset current HEAD to the specified state';
  usage = 'git reset [--soft | --mixed | --hard] [<commit>] | git reset HEAD [<file>...]';

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

      const { mode, target, files, isFileReset } = this.parseArgs(args);

      if (isFileReset) {
        // Reset specific files or all files (unstage)
        return await this.resetFiles(files);
      } else {
        // Reset to commit
        return await this.resetToCommit(target, mode);
      }

    } catch (error) {
      return createErrorResult(`git reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    mode: 'soft' | 'mixed' | 'hard';
    target: string;
    files: string[];
    isFileReset: boolean;
  } {
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed'; // Default mode
    let target = 'HEAD'; // Default target
    const files: string[] = [];
    let foundTarget = false;
    let hasMode = false;

    for (const arg of args) {
      if (arg === '--soft') {
        mode = 'soft';
        hasMode = true;
      } else if (arg === '--mixed') {
        mode = 'mixed';
        hasMode = true;
      } else if (arg === '--hard') {
        mode = 'hard';
        hasMode = true;
      } else if (!arg.startsWith('-')) {
        if (!foundTarget && (arg === 'HEAD' || arg.match(/^[a-f0-9]{7,40}$/) || arg.match(/^HEAD[~^]\d*$/))) {
          target = arg;
          foundTarget = true;
        } else {
          files.push(arg);
        }
      }
    }

    // Determine if this is a file reset operation
    // git reset without arguments = unstage all files
    // git reset HEAD = unstage all files
    // git reset HEAD <files> = unstage specific files
    // git reset <commit> = reset to commit
    // git reset --mode <commit> = reset to commit with mode
    const isFileReset = (args.length === 0) ||
                       (target === 'HEAD' && !hasMode && files.length === 0) ||
                       (files.length > 0);

    return { mode, target, files, isFileReset };
  }

  private async resetFiles(files: string[]): Promise<ShellCommandResult> {
    try {
      const resetFiles: string[] = [];
      const errors: string[] = [];

      if (files.length === 0) {
        // Reset all staged files (git reset or git reset HEAD)
        try {
          // Get the status matrix to find all staged files
          const statusMatrix = await this.git.statusMatrix({
            dir: this.pwd,
          });

          // Find files that are staged (differ from HEAD)
          const stagedFiles = statusMatrix
            .filter(([, headStatus, , stageStatus]) => {
              return headStatus !== stageStatus;
            })
            .map(([filepath]) => filepath);

          if (stagedFiles.length === 0) {
            return createSuccessResult('');
          }

          // Reset each staged file
          for (const file of stagedFiles) {
            try {
              await this.git.resetIndex({
                dir: this.pwd,
                filepath: file,
              });
              resetFiles.push(file);
            } catch (error) {
              errors.push(`error: failed to reset '${file}': ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        } catch (error) {
          return createErrorResult(`Failed to get repository status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Reset specific files
        for (const file of files) {
          try {
            // Remove from staging area (reset to HEAD)
            await this.git.resetIndex({
              dir: this.pwd,
              filepath: file,
            });
            resetFiles.push(file);
          } catch {
            errors.push(`error: pathspec '${file}' did not match any file(s) known to git`);
          }
        }
      }

      if (errors.length > 0) {
        return createErrorResult(errors.join('\n'));
      }

      if (resetFiles.length === 0) {
        return createSuccessResult('');
      }

      return createSuccessResult(`Unstaged changes after reset:\n${resetFiles.map(f => `M\t${f}`).join('\n')}\n`);

    } catch (error) {
      return createErrorResult(`Failed to reset files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async resetToCommit(target: string, mode: 'soft' | 'mixed' | 'hard'): Promise<ShellCommandResult> {
    try {
      // Resolve the target commit
      let targetOid: string;
      try {
        targetOid = await this.git.resolveRef({

          dir: this.pwd,
          ref: target,
        });
      } catch {
        return createErrorResult(`fatal: ambiguous argument '${target}': unknown revision or path not in the working tree.`);
      }

      // Get current HEAD for comparison
      let currentOid: string;
      try {
        currentOid = await this.git.resolveRef({

          dir: this.pwd,
          ref: 'HEAD',
        });
      } catch {
        return createErrorResult('fatal: Failed to resolve HEAD');
      }

      if (currentOid === targetOid) {
        return createSuccessResult('');
      }

      // Note: isomorphic-git doesn't have a direct reset command
      // We'll implement basic functionality based on the mode

      switch (mode) {
        case 'soft':
          // Move HEAD only (keep staging area and working directory)
          // This is complex to implement with isomorphic-git
          return createErrorResult('--soft reset is not implemented in this git command');

        case 'mixed':
          // Move HEAD and reset staging area (default)
          // Reset the index to match the target commit
          try {
            await this.git.checkout({

              dir: this.pwd,
              ref: target,
              noCheckout: true, // Only update the index, not the working directory
            });
            return createSuccessResult(`HEAD is now at ${targetOid.substring(0, 7)}\n`);
          } catch (error) {
            return createErrorResult(`Failed to reset index: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

        case 'hard':
          // Move HEAD, reset staging area, and reset working directory
          try {
            // For a hard reset, we need to:
            // 1. Update HEAD to point to the target commit
            // 2. Reset the index (staging area) to match the target
            // 3. Reset the working directory to match the target

            // Get the commit object to ensure it exists
            await this.git.readCommit({

              dir: this.pwd,
              oid: targetOid,
            });

            // Update HEAD to point to the target commit
            await this.git.writeRef({

              dir: this.pwd,
              ref: 'HEAD',
              value: targetOid,
            });

            // Reset the working directory by checking out all files from the target commit
            // Use force to overwrite any local changes
            await this.git.checkout({

              dir: this.pwd,
              ref: targetOid,
              force: true,
            });

            return createSuccessResult(`HEAD is now at ${targetOid.substring(0, 7)}\n`);
          } catch (error) {
            return createErrorResult(`Failed to reset working directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

        default:
          return createErrorResult(`Unknown reset mode: ${mode}`);
      }

    } catch (error) {
      return createErrorResult(`Failed to reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}