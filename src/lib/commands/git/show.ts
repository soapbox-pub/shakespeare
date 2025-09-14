
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitShowCommand implements GitSubcommand {
  name = 'show';
  description = 'Show various types of objects';
  usage = 'git show [<commit>]';

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

      const { commit } = this.parseArgs(args);

      return await this.showCommit(commit);

    } catch (error) {
      return createErrorResult(`git show: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { commit: string } {
    let commit = 'HEAD'; // Default to HEAD

    for (const arg of args) {
      if (!arg.startsWith('-')) {
        commit = arg;
        break;
      }
    }

    return { commit };
  }

  private async showCommit(commitRef: string): Promise<ShellCommandResult> {
    try {
      // Get the commit
      const commits = await this.git.log({
        dir: this.pwd,
        depth: 1,
        ref: commitRef,
      });

      if (commits.length === 0) {
        return createErrorResult(`fatal: bad revision '${commitRef}'`);
      }

      const commit = commits[0];
      const lines: string[] = [];

      // Show commit information
      lines.push(`commit ${commit.oid}`);

      // Show parent commits if any
      if (commit.commit.parent && commit.commit.parent.length > 0) {
        for (const parent of commit.commit.parent) {
          lines.push(`parent ${parent}`);
        }
      }

      lines.push(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
      lines.push(`Date:   ${new Date(commit.commit.author.timestamp * 1000).toUTCString()}`);
      lines.push('');

      // Show commit message (indented)
      const messageLines = commit.commit.message.split('\n');
      for (const messageLine of messageLines) {
        lines.push(`    ${messageLine}`);
      }
      lines.push('');

      // Try to show file changes (simplified)
      try {
        // Get the tree for this commit
        const tree = await this.git.readTree({
          
          dir: this.pwd,
          oid: commit.oid,
        });

        if (tree.tree.length > 0) {
          lines.push('Files in this commit:');
          for (const entry of tree.tree) {
            const mode = entry.mode === '040000' ? 'tree' : 'blob';
            lines.push(`${mode} ${entry.oid.substring(0, 7)} ${entry.path}`);
          }
        }
      } catch {
        // If we can't read the tree, show a note
        lines.push('(File details not available)');
      }

      return createSuccessResult(lines.join('\n') + '\n');

    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        return createErrorResult(`fatal: bad revision '${commitRef}'`);
      }
      return createErrorResult(`Failed to show commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}