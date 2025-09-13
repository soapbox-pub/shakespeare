import git from 'isomorphic-git';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitResetCommand implements GitSubcommand {
  name = 'reset';
  description = 'Reset current HEAD to the specified state';
  usage = 'git reset [--soft | --mixed | --hard] [<commit>] | git reset HEAD [<file>...]';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { mode, target, files } = this.parseArgs(args);

      if (files.length > 0) {
        // Reset specific files (unstage)
        return await this.resetFiles(fs, cwd, files);
      } else {
        // Reset to commit
        return await this.resetToCommit(fs, cwd, target, mode);
      }

    } catch (error) {
      return createErrorResult(`git reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    mode: 'soft' | 'mixed' | 'hard';
    target: string;
    files: string[]
  } {
    let mode: 'soft' | 'mixed' | 'hard' = 'mixed'; // Default mode
    let target = 'HEAD'; // Default target
    const files: string[] = [];
    let foundTarget = false;

    for (const arg of args) {
      if (arg === '--soft') {
        mode = 'soft';
      } else if (arg === '--mixed') {
        mode = 'mixed';
      } else if (arg === '--hard') {
        mode = 'hard';
      } else if (!arg.startsWith('-')) {
        if (!foundTarget && (arg === 'HEAD' || arg.match(/^[a-f0-9]{7,40}$/))) {
          target = arg;
          foundTarget = true;
        } else {
          files.push(arg);
        }
      }
    }

    return { mode, target, files };
  }

  private async resetFiles(fs: JSRuntimeFS, cwd: string, files: string[]): Promise<ShellCommandResult> {
    try {
      const resetFiles: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        try {
          // Remove from staging area (reset to HEAD)
          await git.resetIndex({
            fs,
            dir: cwd,
            filepath: file,
          });
          resetFiles.push(file);
        } catch {
          errors.push(`error: pathspec '${file}' did not match any file(s) known to git`);
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

  private async resetToCommit(fs: JSRuntimeFS, cwd: string, target: string, mode: 'soft' | 'mixed' | 'hard'): Promise<ShellCommandResult> {
    try {
      // Resolve the target commit
      let targetOid: string;
      try {
        targetOid = await git.resolveRef({
          fs,
          dir: cwd,
          ref: target,
        });
      } catch {
        return createErrorResult(`fatal: ambiguous argument '${target}': unknown revision or path not in the working tree.`);
      }

      // Get current HEAD for comparison
      let currentOid: string;
      try {
        currentOid = await git.resolveRef({
          fs,
          dir: cwd,
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
            await git.checkout({
              fs,
              dir: cwd,
              ref: target,
              noCheckout: true, // Only update the index, not the working directory
            });
            return createSuccessResult(`HEAD is now at ${targetOid.substring(0, 7)}\n`);
          } catch {
            return createErrorResult('Failed to reset index');
          }

        case 'hard':
          // Move HEAD, reset staging area, and reset working directory
          try {
            await git.checkout({
              fs,
              dir: cwd,
              ref: target,
              force: true,
            });
            return createSuccessResult(`HEAD is now at ${targetOid.substring(0, 7)}\n`);
          } catch {
            return createErrorResult('Failed to reset working directory');
          }

        default:
          return createErrorResult(`Unknown reset mode: ${mode}`);
      }

    } catch (error) {
      return createErrorResult(`Failed to reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}