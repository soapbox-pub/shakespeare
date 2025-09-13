import git from 'isomorphic-git';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitLogCommand implements GitSubcommand {
  name = 'log';
  description = 'Show commit logs';
  usage = 'git log [--oneline] [--graph] [-n <number>] [<since>..<until>]';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorError('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { options, limit } = this.parseArgs(args);

      try {
        const commits = await git.log({
          fs,
          dir: cwd,
          depth: limit,
        });

        if (commits.length === 0) {
          return createErrorResult('fatal: your current branch does not have any commits yet');
        }

        if (options.oneline) {
          return this.formatOnelineLog(commits);
        } else {
          return this.formatFullLog(commits, options.graph);
        }

      } catch (error) {
        if (error instanceof Error && error.message.includes('does not exist')) {
          return createErrorResult('fatal: your current branch does not have any commits yet');
        }
        throw error;
      }

    } catch (error) {
      return createErrorResult(`git log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    options: { oneline: boolean; graph: boolean };
    limit: number
  } {
    const options = { oneline: false, graph: false };
    let limit = 50; // Default limit

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--oneline') {
        options.oneline = true;
      } else if (arg === '--graph') {
        options.graph = true;
      } else if (arg === '-n' || arg === '--max-count') {
        if (i + 1 < args.length) {
          const num = parseInt(args[i + 1], 10);
          if (!isNaN(num) && num > 0) {
            limit = num;
          }
          i++; // Skip next argument
        }
      } else if (arg.startsWith('-n=')) {
        const num = parseInt(arg.substring(3), 10);
        if (!isNaN(num) && num > 0) {
          limit = num;
        }
      } else if (arg.startsWith('--max-count=')) {
        const num = parseInt(arg.substring(12), 10);
        if (!isNaN(num) && num > 0) {
          limit = num;
        }
      } else if (arg.match(/^-\d+$/)) {
        // Handle -5, -10, etc.
        const num = parseInt(arg.substring(1), 10);
        if (!isNaN(num) && num > 0) {
          limit = num;
        }
      }
    }

    return { options, limit };
  }

  private formatOnelineLog(commits: Array<{ oid: string; commit: { message: string } }>): ShellCommandResult {
    const lines: string[] = [];

    for (const commit of commits) {
      const shortHash = commit.oid.substring(0, 7);
      const message = commit.commit.message.split('\n')[0]; // First line only
      lines.push(`${shortHash} ${message}`);
    }

    return createSuccessResult(lines.join('\n') + '\n');
  }

  private formatFullLog(commits: Array<{ oid: string; commit: { message: string; author: { name: string; email: string; timestamp: number } } }>, showGraph: boolean): ShellCommandResult {
    const lines: string[] = [];

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const isLast = i === commits.length - 1;

      if (showGraph) {
        lines.push('* commit ' + commit.oid);
      } else {
        lines.push('commit ' + commit.oid);
      }

      // Author information
      const author = commit.commit.author;
      const authorDate = new Date(author.timestamp * 1000);
      const authorDateStr = authorDate.toUTCString();

      lines.push(`Author: ${author.name} <${author.email}>`);
      lines.push(`Date:   ${authorDateStr}`);
      lines.push('');

      // Commit message (indented)
      const messageLines = commit.commit.message.split('\n');
      for (const messageLine of messageLines) {
        lines.push(`    ${messageLine}`);
      }

      if (!isLast) {
        lines.push('');
      }
    }

    return createSuccessResult(lines.join('\n') + '\n');
  }
}

// Fix the typo in the error function
function createErrorError(message: string): ShellCommandResult {
  return createErrorResult(message);
}