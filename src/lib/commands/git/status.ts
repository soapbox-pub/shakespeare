import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitStatusCommand implements GitSubcommand {
  name = 'status';
  description = 'Show the working tree status';
  usage = 'git status [--porcelain] [--short]';

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

      const options = this.parseArgs(args);

      // Get the status matrix
      const statusMatrix = await this.git.statusMatrix({
        dir: cwd,
      });

      // Get current branch
      let currentBranch: string | null = null;
      try {
        currentBranch = await this.git.currentBranch({
          dir: cwd,
        }) || null;
      } catch {
        // Might be an empty repository
      }

      if (options.porcelain || options.short) {
        return this.formatPorcelainStatus(statusMatrix, cwd);
      } else {
        return this.formatHumanStatus(statusMatrix, currentBranch, cwd);
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

  private  formatPorcelainStatus(statusMatrix: Array<[string, number, number, number]>, _cwd: string): ShellCommandResult  {
    const lines: string[] = [];

    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      let indexStatus = ' ';
      let workingStatus = ' ';

      // Determine index status (staged changes - comparing HEAD to stage)
      if (headStatus === 0 && stageStatus === 2) {
        indexStatus = 'A'; // Added to stage
      } else if (headStatus === 1 && stageStatus === 0) {
        indexStatus = 'D'; // Deleted from stage
      } else if (headStatus === 1 && stageStatus === 2) {
        indexStatus = 'M'; // Modified in stage
      }

      // Determine working directory status (comparing stage to working dir)
      if (headStatus === 0 && stageStatus === 0 && workdirStatus === 2) {
        // Untracked files show as ?? in porcelain format
        indexStatus = '?';
        workingStatus = '?';
      } else if (stageStatus === 2 && workdirStatus === 0) {
        workingStatus = 'D'; // Deleted in working dir
      } else if (stageStatus === 1 && workdirStatus === 0) {
        workingStatus = 'D'; // Deleted in working dir (was same as HEAD)
      } else if (stageStatus !== workdirStatus && workdirStatus === 2) {
        workingStatus = 'M'; // Modified in working dir
      }

      // Only show files with changes
      if (indexStatus !== ' ' || workingStatus !== ' ') {
        lines.push(`${indexStatus}${workingStatus} ${filepath}`);
      }
    }

    return createSuccessResult(lines.join('\n') + (lines.length > 0 ? '\n' : ''));
  }

  private  formatHumanStatus(statusMatrix: Array<[string, number, number, number]>, currentBranch: string | null, _cwd: string): ShellCommandResult  {
    const lines: string[] = [];

    // Show current branch
    if (currentBranch) {
      lines.push(`On branch ${currentBranch}`);
    } else {
      lines.push('HEAD detached at unknown');
    }

    // Categorize changes
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const deleted: string[] = [];

    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      // Staged changes (stage differs from HEAD)
      if (headStatus === 0 && stageStatus === 2) {
        staged.push(`\tnew file:   ${filepath}`);
      } else if (headStatus === 1 && stageStatus === 0) {
        staged.push(`\tdeleted:    ${filepath}`);
      } else if (headStatus === 1 && stageStatus === 2) {
        staged.push(`\tmodified:   ${filepath}`);
      }

      // Working directory changes (working dir differs from stage)
      if (stageStatus === 2 && workdirStatus === 0) {
        deleted.push(`\tdeleted:    ${filepath}`);
      } else if (stageStatus === 1 && workdirStatus === 0) {
        deleted.push(`\tdeleted:    ${filepath}`);
      } else if (stageStatus !== workdirStatus && workdirStatus === 2) {
        modified.push(`\tmodified:   ${filepath}`);
      }

      // Untracked files (not in HEAD, not in stage, but in working dir)
      if (headStatus === 0 && stageStatus === 0 && workdirStatus === 2) {
        untracked.push(`\t${filepath}`);
      }
    }

    // Show staged changes
    if (staged.length > 0) {
      lines.push('');
      lines.push('Changes to be committed:');
      lines.push('  (use "git restore --staged <file>..." to unstage)');
      lines.push('');
      lines.push(...staged);
    }

    // Show unstaged changes
    if (modified.length > 0 || deleted.length > 0) {
      lines.push('');
      lines.push('Changes not staged for commit:');
      lines.push('  (use "git add <file>..." to update what will be committed)');
      lines.push('  (use "git restore <file>..." to discard changes in working directory)');
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
