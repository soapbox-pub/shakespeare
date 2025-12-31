import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitLogCommand implements GitSubcommand {
  name = 'log';
  description = 'Show commit logs';
  usage = 'git log [--oneline] [--graph] [--format=<format>] [-n <number>] [--all] [<ref>]';

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

      const { options, limit, ref } = this.parseArgs(args);

      try {
        const logOptions: { dir: string; depth?: number; ref?: string } = { dir: cwd };
        if (limit !== undefined) {
          logOptions.depth = limit;
        }
        if (ref !== undefined) {
          logOptions.ref = ref;
        }

        const commits = await this.git.log(logOptions);

        if (commits.length === 0) {
          return createErrorResult('fatal: your current branch does not have any commits yet');
        }

        // Determine format based on options
        const format = options.format || (options.oneline ? 'oneline' : 'full');

        return this.formatLog(commits, format, options.graph, cwd);

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
    options: { oneline: boolean; graph: boolean; format?: string };
    limit: number | undefined;
    ref?: string;
  } {
    const options: { oneline: boolean; graph: boolean; format?: string } = {
      oneline: false,
      graph: false
    };
    let limit: number | undefined = undefined; // No default limit - show all commits
    let ref: string | undefined = undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--oneline') {
        options.oneline = true;
      } else if (arg === '--graph') {
        options.graph = true;
      } else if (arg === '--all') {
        // --all is not directly supported by isomorphic-git log
        // We'll just ignore it for now
      } else if (arg === '--format' || arg === '--pretty') {
        if (i + 1 < args.length) {
          options.format = args[i + 1];
          i++; // Skip next argument
        }
      } else if (arg.startsWith('--format=')) {
        options.format = arg.substring(9);
      } else if (arg.startsWith('--pretty=')) {
        options.format = arg.substring(9);
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
      } else if (!arg.startsWith('-')) {
        // Treat as a ref (branch name, commit hash, etc.)
        ref = arg;
      }
    }

    return { options, limit, ref };
  }

  private formatLog(
    commits: Array<{ oid: string; commit: { message: string; author: { name: string; email: string; timestamp: number }; committer?: { name: string; email: string; timestamp: number } } }>,
    format: string,
    showGraph: boolean,
    _cwd: string
  ): ShellCommandResult {
    const lines: string[] = [];

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const isLast = i === commits.length - 1;
      const graphPrefix = showGraph ? '* ' : '';

      // Format based on the specified format
      switch (format) {
        case 'oneline':
          lines.push(this.formatOneline(commit, graphPrefix));
          break;

        case 'short':
          lines.push(this.formatShort(commit, graphPrefix));
          if (!isLast) lines.push('');
          break;

        case 'medium':
        case 'full':
        default:
          lines.push(this.formatFull(commit, graphPrefix));
          if (!isLast) lines.push('');
          break;

        case 'fuller':
          lines.push(this.formatFuller(commit, graphPrefix));
          if (!isLast) lines.push('');
          break;

        case 'raw':
          lines.push(this.formatRaw(commit));
          if (!isLast) lines.push('');
          break;
      }
    }

    return createSuccessResult(lines.join('\n') + '\n');
  }

  private formatOneline(commit: { oid: string; commit: { message: string } }, graphPrefix: string): string {
    const shortHash = commit.oid.substring(0, 7);
    const message = commit.commit.message.split('\n')[0]; // First line only
    return `${graphPrefix}${shortHash} ${message}`;
  }

  private formatShort(commit: { oid: string; commit: { message: string; author: { name: string; email: string } } }, graphPrefix: string): string {
    const lines: string[] = [];
    const shortHash = commit.oid.substring(0, 7);

    lines.push(`${graphPrefix}commit ${shortHash}`);
    lines.push(`Author: ${commit.commit.author.name} <${commit.commit.author.email}>`);
    lines.push('');

    const messageLines = commit.commit.message.split('\n');
    for (const messageLine of messageLines) {
      lines.push(`    ${messageLine}`);
    }

    return lines.join('\n');
  }

  private formatFull(commit: { oid: string; commit: { message: string; author: { name: string; email: string; timestamp: number } } }, graphPrefix: string): string {
    const lines: string[] = [];

    lines.push(`${graphPrefix}commit ${commit.oid}`);

    const author = commit.commit.author;
    const authorDate = new Date(author.timestamp * 1000);
    const authorDateStr = authorDate.toUTCString();

    lines.push(`Author: ${author.name} <${author.email}>`);
    lines.push(`Date:   ${authorDateStr}`);
    lines.push('');

    const messageLines = commit.commit.message.split('\n');
    for (const messageLine of messageLines) {
      lines.push(`    ${messageLine}`);
    }

    return lines.join('\n');
  }

  private formatFuller(commit: { oid: string; commit: { message: string; author: { name: string; email: string; timestamp: number }; committer?: { name: string; email: string; timestamp: number } } }, graphPrefix: string): string {
    const lines: string[] = [];

    lines.push(`${graphPrefix}commit ${commit.oid}`);

    const author = commit.commit.author;
    const authorDate = new Date(author.timestamp * 1000);

    lines.push(`Author:     ${author.name} <${author.email}>`);
    lines.push(`AuthorDate: ${authorDate.toUTCString()}`);

    // Include committer info if available
    if (commit.commit.committer) {
      const committer = commit.commit.committer;
      const commitDate = new Date(committer.timestamp * 1000);
      lines.push(`Commit:     ${committer.name} <${committer.email}>`);
      lines.push(`CommitDate: ${commitDate.toUTCString()}`);
    }

    lines.push('');

    const messageLines = commit.commit.message.split('\n');
    for (const messageLine of messageLines) {
      lines.push(`    ${messageLine}`);
    }

    return lines.join('\n');
  }

  private formatRaw(commit: { oid: string; commit: { message: string; author: { name: string; email: string; timestamp: number }; committer?: { name: string; email: string; timestamp: number } } }): string {
    const lines: string[] = [];

    lines.push(`commit ${commit.oid}`);

    const author = commit.commit.author;
    lines.push(`author ${author.name} <${author.email}> ${author.timestamp} +0000`);

    if (commit.commit.committer) {
      const committer = commit.commit.committer;
      lines.push(`committer ${committer.name} <${committer.email}> ${committer.timestamp} +0000`);
    }

    lines.push('');
    lines.push(commit.commit.message);

    return lines.join('\n');
  }
}

