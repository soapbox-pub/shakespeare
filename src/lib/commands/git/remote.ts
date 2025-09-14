
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitRemoteCommand implements GitSubcommand {
  name = 'remote';
  description = 'Manage set of tracked repositories';
  usage = 'git remote [-v] | git remote add <name> <url> | git remote remove <name>';

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

      const { action, name, url, options } = this.parseArgs(args);

      switch (action) {
        case 'list':
          return await this.listRemotes(options.verbose);
        case 'add':
          return await this.addRemote(name!, url!);
        case 'remove':
          return await this.removeRemote(name!);
        default:
          return await this.listRemotes(options.verbose);
      }

    } catch (error) {
      return createErrorResult(`git remote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    action: 'list' | 'add' | 'remove';
    name?: string;
    url?: string;
    options: { verbose: boolean }
  } {
    const options = { verbose: false };
    let action: 'list' | 'add' | 'remove' = 'list';
    let name: string | undefined;
    let url: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-v' || arg === '--verbose') {
        options.verbose = true;
      } else if (arg === 'add') {
        action = 'add';
        if (i + 1 < args.length) {
          name = args[i + 1];
          i++;
        }
        if (i + 1 < args.length) {
          url = args[i + 1];
          i++;
        }
      } else if (arg === 'remove' || arg === 'rm') {
        action = 'remove';
        if (i + 1 < args.length) {
          name = args[i + 1];
          i++;
        }
      }
    }

    return { action, name, url, options };
  }

  private async listRemotes(verbose: boolean): Promise<ShellCommandResult> {
    try {
      const remotes = await this.git.listRemotes({
        dir: this.pwd,
      });

      if (remotes.length === 0) {
        return createSuccessResult('');
      }

      const lines: string[] = [];

      if (verbose) {
        for (const remote of remotes) {
          lines.push(`${remote.remote}\t${remote.url} (fetch)`);
          lines.push(`${remote.remote}\t${remote.url} (push)`);
        }
      } else {
        for (const remote of remotes) {
          lines.push(remote.remote);
        }
      }

      return createSuccessResult(lines.join('\n') + (lines.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`Failed to list remotes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async addRemote(name: string, url: string): Promise<ShellCommandResult> {
    try {
      if (!name || !url) {
        return createErrorResult('usage: git remote add <name> <url>');
      }

      // Check if remote already exists
      try {
        const remotes = await this.git.listRemotes({
          
          dir: this.pwd,
        });

        const existingRemote = remotes.find(r => r.remote === name);
        if (existingRemote) {
          return createErrorResult(`fatal: remote ${name} already exists.`);
        }
      } catch {
        // Continue if we can't list remotes
      }

      // Add the remote
      await this.git.addRemote({
        dir: this.pwd,
        remote: name,
        url: url,
      });

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`Failed to add remote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async removeRemote(name: string): Promise<ShellCommandResult> {
    try {
      if (!name) {
        return createErrorResult('usage: git remote remove <name>');
      }

      // Check if remote exists
      try {
        const remotes = await this.git.listRemotes({
          
          dir: this.pwd,
        });

        const existingRemote = remotes.find(r => r.remote === name);
        if (!existingRemote) {
          return createErrorResult(`fatal: No such remote: ${name}`);
        }
      } catch {
        return createErrorResult(`fatal: No such remote: ${name}`);
      }

      // Remove the remote
      await this.git.deleteRemote({
        dir: this.pwd,
        remote: name,
      });

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`Failed to remove remote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}