
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitDiffCommand implements GitSubcommand {
  name = 'diff';
  description = 'Show changes between commits, commit and working tree, etc';
  usage = 'git diff [<commit>] [<commit>] [-- <path>...]';

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

      const { commits, paths, options } = this.parseArgs(args);

      if (options.cached || options.staged) {
        // Show staged changes (index vs HEAD)
        return await this.showStagedDiff(paths);
      } else if (commits.length === 0) {
        // Show working directory changes vs index
        return await this.showWorkingDirectoryDiff(paths);
      } else if (commits.length === 1) {
        // Show changes between commit and working directory
        return await this.showCommitDiff(commits[0], paths);
      } else if (commits.length === 2) {
        // Show changes between two commits
        return await this.showCommitRangeDiff(commits[0], commits[1], paths);
      } else {
        return createErrorResult('usage: git diff [<commit>] [<commit>] [-- <path>...]');
      }

    } catch (error) {
      return createErrorResult(`git diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    commits: string[];
    paths: string[];
    options: { cached: boolean; staged: boolean }
  } {
    const options = { cached: false, staged: false };
    const commits: string[] = [];
    const paths: string[] = [];
    let foundDoubleDash = false;

    for (const arg of args) {
      if (arg === '--') {
        foundDoubleDash = true;
        continue;
      }

      if (foundDoubleDash) {
        paths.push(arg);
      } else if (arg === '--cached' || arg === '--staged') {
        options.cached = true;
        options.staged = true;
      } else if (!arg.startsWith('-')) {
        // Assume it's a commit reference
        commits.push(arg);
      }
    }

    return { commits, paths, options };
  }

  private async showWorkingDirectoryDiff(paths: string[]): Promise<ShellCommandResult> {
    try {
      // Get status to find changed files
      const statusMatrix = await this.git.statusMatrix({
        dir: this.pwd,
      });

      // Filter for files with working directory changes
      // Status matrix: [filepath, headStatus, workdirStatus, stageStatus]
      // 0 = absent, 1 = same as previous stage, 2 = different from previous stage
      const changedFiles = statusMatrix.filter(([filepath, _headStatus, workdirStatus, stageStatus]) => {
        // Show files that have working directory changes (differ from index)
        // Exclude untracked files - git diff only shows changes to tracked files
        const hasWorkingDirChanges = (stageStatus !== workdirStatus && workdirStatus === 2 && stageStatus !== 0) ||
                                   (stageStatus === 2 && workdirStatus === 0) ||
                                   (stageStatus === 1 && workdirStatus === 0);

        if (paths.length > 0) {
          return hasWorkingDirChanges && paths.some(path => filepath.includes(path));
        }
        return hasWorkingDirChanges;
      });

      if (changedFiles.length === 0) {
        return createSuccessResult('');
      }

      const diffLines: string[] = [];

      for (const [filepath, _headStatus, workdirStatus, stageStatus] of changedFiles) {
        try {
          // Get staged/index content
          let indexContent = '';
          if (stageStatus === 1 || stageStatus === 2) {
            try {
              // For files in the index, read from HEAD as the baseline
              // This represents the last committed version for comparison
              const headBlob = await this.git.readBlob({
                dir: this.pwd,
                oid: 'HEAD',
                filepath,
              });
              indexContent = new TextDecoder().decode(headBlob.blob);
            } catch {
              // File might be new or not in HEAD
              indexContent = '';
            }
          }

          // Get working directory content
          let workdirContent = '';
          if (workdirStatus === 2) {
            try {
              workdirContent = await this.fs.readFile(`${this.pwd}/${filepath}`, 'utf8');
            } catch {
              // File might be deleted
              workdirContent = '';
            }
          } else if (workdirStatus === 0) {
            // File is deleted in working directory
            workdirContent = '';
          }

          // Skip if contents are identical
          if (indexContent === workdirContent) {
            continue;
          }

          // Generate diff header
          diffLines.push(`diff --git a/${filepath} b/${filepath}`);

          if (workdirStatus === 0 && (stageStatus === 1 || stageStatus === 2)) {
            // Deleted file
            diffLines.push('deleted file mode 100644');
            diffLines.push(`index ${this.getShortHash(indexContent)}..0000000`);
            diffLines.push(`--- a/${filepath}`);
            diffLines.push('+++ /dev/null');
          } else {
            // Modified file
            diffLines.push(`index ${this.getShortHash(indexContent)}..${this.getShortHash(workdirContent)} 100644`);
            diffLines.push(`--- a/${filepath}`);
            diffLines.push(`+++ b/${filepath}`);
          }

          // Generate unified diff
          const indexLines = indexContent.split('\n');
          const workdirLines = workdirContent.split('\n');

          // Simple hunk header
          diffLines.push(`@@ -1,${indexLines.length} +1,${workdirLines.length} @@`);

          // Simple line-by-line diff
          const maxLines = Math.max(indexLines.length, workdirLines.length);
          for (let i = 0; i < maxLines; i++) {
            const oldLine = indexLines[i];
            const newLine = workdirLines[i];

            if (oldLine !== undefined && newLine !== undefined) {
              if (oldLine === newLine) {
                // Unchanged line (show context)
                diffLines.push(` ${oldLine}`);
              } else {
                // Changed line
                diffLines.push(`-${oldLine}`);
                diffLines.push(`+${newLine}`);
              }
            } else if (oldLine !== undefined) {
              // Removed line
              diffLines.push(`-${oldLine}`);
            } else if (newLine !== undefined) {
              // Added line
              diffLines.push(`+${newLine}`);
            }
          }

          diffLines.push('');
        } catch (error) {
          // Skip files that can't be diffed
          console.warn(`Failed to diff ${filepath}:`, error);
        }
      }

      return createSuccessResult(diffLines.join('\n'));

    } catch (error) {
      return createErrorResult(`Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async showCommitDiff(commit: string, _paths: string[]): Promise<ShellCommandResult> {
    try {
      // For simplicity, show the commit message and changed files
      const commits = await this.git.log({

        dir: this.pwd,
        depth: 1,
        ref: commit,
      });

      if (commits.length === 0) {
        return createErrorResult(`fatal: bad revision '${commit}'`);
      }

      const commitObj = commits[0];
      const lines: string[] = [];

      lines.push(`commit ${commitObj.oid}`);
      lines.push(`Author: ${commitObj.commit.author.name} <${commitObj.commit.author.email}>`);
      lines.push(`Date:   ${new Date(commitObj.commit.author.timestamp * 1000).toUTCString()}`);
      lines.push('');
      lines.push(`    ${commitObj.commit.message}`);
      lines.push('');

      // Note: Showing actual file diffs would require more complex implementation
      lines.push('(File content diff not implemented - use git log for commit details)');

      return createSuccessResult(lines.join('\n'));

    } catch (error) {
      return createErrorResult(`Failed to show commit diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async showCommitRangeDiff(_commit1: string, _commit2: string, _paths: string[]): Promise<ShellCommandResult> {
    // This would require complex implementation to compare two commits
    return createErrorResult('Commit range diff is not implemented in this git command');
  }

  private async showStagedDiff(paths: string[]): Promise<ShellCommandResult> {
    try {
      // Get status to find staged files
      const statusMatrix = await this.git.statusMatrix({
        dir: this.pwd,
      });

      // Filter for files with staged changes (index differs from HEAD)
      const stagedFiles = statusMatrix.filter(([filepath, headStatus, _workdirStatus, stageStatus]) => {
        const hasStagedChanges = (headStatus === 0 && stageStatus === 2) || // Added to stage
                                (headStatus === 1 && stageStatus === 0) || // Deleted from stage
                                (headStatus === 1 && stageStatus === 2);   // Modified in stage

        if (paths.length > 0) {
          return hasStagedChanges && paths.some(path => filepath.includes(path));
        }
        return hasStagedChanges;
      });

      if (stagedFiles.length === 0) {
        return createSuccessResult('');
      }

      const diffLines: string[] = [];

      for (const [filepath, headStatus, _workdirStatus, stageStatus] of stagedFiles) {
        try {
          // Get HEAD content
          let headContent = '';
          if (headStatus === 1) {
            try {
              const headBlob = await this.git.readBlob({
                dir: this.pwd,
                oid: 'HEAD',
                filepath,
              });
              headContent = new TextDecoder().decode(headBlob.blob);
            } catch {
              headContent = '';
            }
          }

          // Get staged content (approximated by working directory for now)
          let stagedContent = '';
          if (stageStatus === 1 || stageStatus === 2) {
            try {
              stagedContent = await this.fs.readFile(`${this.pwd}/${filepath}`, 'utf8');
            } catch {
              stagedContent = '';
            }
          }

          // Generate diff header
          diffLines.push(`diff --git a/${filepath} b/${filepath}`);

          if (headStatus === 0 && stageStatus === 2) {
            // New file staged
            diffLines.push('new file mode 100644');
            diffLines.push(`index 0000000..${this.getShortHash(stagedContent)}`);
            diffLines.push('--- /dev/null');
            diffLines.push(`+++ b/${filepath}`);
          } else if (headStatus === 1 && stageStatus === 0) {
            // File deleted from stage
            diffLines.push('deleted file mode 100644');
            diffLines.push(`index ${this.getShortHash(headContent)}..0000000`);
            diffLines.push(`--- a/${filepath}`);
            diffLines.push('+++ /dev/null');
          } else {
            // Modified file
            diffLines.push(`index ${this.getShortHash(headContent)}..${this.getShortHash(stagedContent)} 100644`);
            diffLines.push(`--- a/${filepath}`);
            diffLines.push(`+++ b/${filepath}`);
          }

          // Generate unified diff
          const headLines = headContent.split('\n');
          const stagedLines = stagedContent.split('\n');

          diffLines.push(`@@ -1,${headLines.length} +1,${stagedLines.length} @@`);

          // Simple line-by-line diff
          const maxLines = Math.max(headLines.length, stagedLines.length);
          for (let i = 0; i < maxLines; i++) {
            const oldLine = headLines[i];
            const newLine = stagedLines[i];

            if (oldLine !== undefined && newLine !== undefined) {
              if (oldLine === newLine) {
                // Unchanged line (show context)
                diffLines.push(` ${oldLine}`);
              } else {
                // Changed line
                diffLines.push(`-${oldLine}`);
                diffLines.push(`+${newLine}`);
              }
            } else if (oldLine !== undefined) {
              // Removed line
              diffLines.push(`-${oldLine}`);
            } else if (newLine !== undefined) {
              // Added line
              diffLines.push(`+${newLine}`);
            }
          }

          diffLines.push('');
        } catch (error) {
          console.warn(`Failed to diff staged ${filepath}:`, error);
        }
      }

      return createSuccessResult(diffLines.join('\n'));

    } catch (error) {
      return createErrorResult(`Failed to show staged diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getShortHash(content: string): string {
    // Simple hash for demo purposes - not a real git hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 7).padStart(7, '0');
  }
}