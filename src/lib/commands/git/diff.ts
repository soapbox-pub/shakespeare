import git from 'isomorphic-git';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitDiffCommand implements GitSubcommand {
  name = 'diff';
  description = 'Show changes between commits, commit and working tree, etc';
  usage = 'git diff [<commit>] [<commit>] [-- <path>...]';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { commits, paths } = this.parseArgs(args);

      if (commits.length === 0) {
        // Show working directory changes vs index
        return await this.showWorkingDirectoryDiff(fs, cwd, paths);
      } else if (commits.length === 1) {
        // Show changes between commit and working directory
        return await this.showCommitDiff(fs, cwd, commits[0], paths);
      } else if (commits.length === 2) {
        // Show changes between two commits
        return await this.showCommitRangeDiff(fs, cwd, commits[0], commits[1], paths);
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

  private async showWorkingDirectoryDiff(fs: JSRuntimeFS, cwd: string, paths: string[]): Promise<ShellCommandResult> {
    try {
      // Get status to find changed files
      const statusMatrix = await git.statusMatrix({
        fs,
        dir: cwd,
      });

      // Filter for modified files in working directory
      const modifiedFiles = statusMatrix.filter(([filepath, headStatus, workdirStatus, stageStatus]) => {
        const isModified = workdirStatus === 1 && stageStatus === 1 && headStatus !== workdirStatus;
        if (paths.length > 0) {
          return isModified && paths.some(path => filepath.includes(path));
        }
        return isModified;
      });

      if (modifiedFiles.length === 0) {
        return createSuccessResult('');
      }

      const diffLines: string[] = [];

      for (const [filepath] of modifiedFiles) {
        try {
          // Get file content from HEAD
          let headContent = '';
          try {
            const headBlob = await git.readBlob({
              fs,
              dir: cwd,
              oid: 'HEAD',
              filepath,
            });
            headContent = new TextDecoder().decode(headBlob.blob);
          } catch {
            // File might be new
          }

          // Get file content from working directory
          let workdirContent = '';
          try {
            workdirContent = await fs.readFile(`${cwd}/${filepath}`, 'utf8');
          } catch {
            // File might be deleted
          }

          // Simple diff representation
          diffLines.push(`diff --git a/${filepath} b/${filepath}`);
          diffLines.push(`index ${this.getShortHash(headContent)}..${this.getShortHash(workdirContent)} 100644`);
          diffLines.push(`--- a/${filepath}`);
          diffLines.push(`+++ b/${filepath}`);

          // Show a simplified diff
          const headLines = headContent.split('\n');
          const workdirLines = workdirContent.split('\n');

          diffLines.push(`@@ -1,${headLines.length} +1,${workdirLines.length} @@`);

          // Show removed lines
          for (const line of headLines) {
            if (!workdirLines.includes(line)) {
              diffLines.push(`-${line}`);
            }
          }

          // Show added lines
          for (const line of workdirLines) {
            if (!headLines.includes(line)) {
              diffLines.push(`+${line}`);
            }
          }

          diffLines.push('');
        } catch {
          // Skip files that can't be diffed
        }
      }

      return createSuccessResult(diffLines.join('\n'));

    } catch (error) {
      return createErrorResult(`Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async showCommitDiff(fs: JSRuntimeFS, cwd: string, commit: string, _paths: string[]): Promise<ShellCommandResult> {
    try {
      // For simplicity, show the commit message and changed files
      const commits = await git.log({
        fs,
        dir: cwd,
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

  private async showCommitRangeDiff(_fs: JSRuntimeFS, _cwd: string, _commit1: string, _commit2: string, _paths: string[]): Promise<ShellCommandResult> {
    // This would require complex implementation to compare two commits
    return createErrorResult('Commit range diff is not implemented in this git command');
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