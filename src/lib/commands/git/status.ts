import git from 'isomorphic-git';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitStatusCommand implements GitSubcommand {
  name = 'status';
  description = 'Show the working tree status';
  usage = 'git status [--porcelain] [--short]';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const options = this.parseArgs(args);

      // Get the status matrix
      const statusMatrix = await git.statusMatrix({
        fs,
        dir: cwd,
      });

      // Get current branch
      let currentBranch: string | null = null;
      try {
        currentBranch = await git.currentBranch({
          fs,
          dir: cwd,
        }) || null;
      } catch {
        // Might be an empty repository
      }

      if (options.porcelain || options.short) {
        return this.formatPorcelainStatus(statusMatrix);
      } else {
        return this.formatHumanStatus(statusMatrix, currentBranch);
      }

    } catch (error) {
      return createErrorResult(`git status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { porcelain: boolean; short: boolean } {
    const options = { porcelain: false, short: false };

    for (const arg of args) {
      if (arg === '--porcelain') {
        options.porcelain = true;
      } else if (arg === '--short' || arg === '-s') {
        options.short = true;
      }
    }

    return options;
  }

  private formatPorcelainStatus(statusMatrix: Array<[string, number, number, number]>): ShellCommandResult {
    const lines: string[] = [];

    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      let indexStatus = ' ';
      let workingStatus = ' ';

      // Determine index status (staged changes)
      if (headStatus === 0 && stageStatus === 1) {
        indexStatus = 'A'; // Added
      } else if (headStatus === 1 && stageStatus === 0) {
        indexStatus = 'D'; // Deleted
      } else if (headStatus === 1 && stageStatus === 1 && headStatus !== stageStatus) {
        indexStatus = 'M'; // Modified
      }

      // Determine working directory status
      if (headStatus === 0 && stageStatus === 0 && workdirStatus === 1) {
        workingStatus = '?'; // Untracked
      } else if (stageStatus === 1 && workdirStatus === 0) {
        workingStatus = 'D'; // Deleted
      } else if (stageStatus !== workdirStatus) {
        workingStatus = 'M'; // Modified
      }

      // Only show files with changes
      if (indexStatus !== ' ' || workingStatus !== ' ') {
        lines.push(`${indexStatus}${workingStatus} ${filepath}`);
      }
    }

    return createSuccessResult(lines.join('\n') + (lines.length > 0 ? '\n' : ''));
  }

  private formatHumanStatus(statusMatrix: Array<[string, number, number, number]>, currentBranch: string | null): ShellCommandResult {
    const lines: string[] = [];

    // Show current branch
    if (currentBranch) {
      lines.push(`On branch ${currentBranch}`);
    } else {
      lines.push('On branch main');
    }

    // Categorize changes
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const deleted: string[] = [];

    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      // Staged changes (index differs from HEAD)
      if (headStatus === 0 && stageStatus === 1) {
        staged.push(`\tnew file:   ${filepath}`);
      } else if (headStatus === 1 && stageStatus === 0) {
        staged.push(`\tdeleted:    ${filepath}`);
      } else if (headStatus !== stageStatus && headStatus === 1 && stageStatus === 1) {
        staged.push(`\tmodified:   ${filepath}`);
      }

      // Working directory changes (working dir differs from index)
      if (stageStatus === 1 && workdirStatus === 0) {
        deleted.push(`\tdeleted:    ${filepath}`);
      } else if (stageStatus !== workdirStatus && stageStatus === 1 && workdirStatus === 1) {
        modified.push(`\tmodified:   ${filepath}`);
      }

      // Untracked files
      if (headStatus === 0 && stageStatus === 0 && workdirStatus === 1) {
        untracked.push(`\t${filepath}`);
      }
    }

    // Show staged changes
    if (staged.length > 0) {
      lines.push('');
      lines.push('Changes to be committed:');
      lines.push('  (use "git reset HEAD <file>..." to unstage)');
      lines.push('');
      lines.push(...staged);
    }

    // Show unstaged changes
    if (modified.length > 0 || deleted.length > 0) {
      lines.push('');
      lines.push('Changes not staged for commit:');
      lines.push('  (use "git add <file>..." to update what will be committed)');
      lines.push('  (use "git checkout -- <file>..." to discard changes in working directory)');
      lines.push('');
      lines.push(...modified);
      lines.push(...deleted);
    }

    // Show untracked files
    if (untracked.length > 0) {
      lines.push('');
      lines.push('Untracked files:');
      lines.push('  (use "git add <file>..." to include in what will be committed)');
      lines.push('');
      lines.push(...untracked);
    }

    // Clean status
    if (staged.length === 0 && modified.length === 0 && deleted.length === 0 && untracked.length === 0) {
      lines.push('nothing to commit, working tree clean');
    }

    lines.push('');
    return createSuccessResult(lines.join('\n'));
  }
}