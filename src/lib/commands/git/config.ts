import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitConfigCommand implements GitSubcommand {
  name = 'config';
  description = 'Get and set repository or global options';
  usage = 'git config [--global] <name> [<value>] | git config [--global] --list';

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
      const { action, key, value, options } = this.parseArgs(args);

      // Check if we're in a git repository (unless --global is used)
      if (!options.global) {
        try {
          await this.fs.stat(`${this.pwd}/.git`);
        } catch {
          return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
        }
      }

      switch (action) {
        case 'list':
          return await this.listConfig(options.global);
        case 'get':
          return await this.getConfig(key!, options.global);
        case 'set':
          return await this.setConfig(key!, value!, options.global);
        default:
          return createErrorResult('usage: git config [--global] <name> [<value>] | git config [--global] --list');
      }

    } catch (error) {
      return createErrorResult(`git config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    action: 'list' | 'get' | 'set';
    key?: string;
    value?: string;
    options: { global: boolean }
  } {
    const options = { global: false };
    let action: 'list' | 'get' | 'set' = 'get';
    let key: string | undefined;
    let value: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--global') {
        options.global = true;
      } else if (arg === '--list' || arg === '-l') {
        action = 'list';
      } else if (!arg.startsWith('-')) {
        if (!key) {
          key = arg;
          action = 'get'; // Default to get if only key is provided
        } else if (!value) {
          value = arg;
          action = 'set'; // Set if both key and value are provided
        }
      }
    }

    return { action, key, value, options };
  }

  private async listConfig(global: boolean): Promise<ShellCommandResult> {
    try {
      // For simplicity, we'll only show the most common config values
      // isomorphic-git doesn't have a direct way to list all config
      const commonKeys = [
        'user.name',
        'user.email',
        'core.bare',
        'remote.origin.url',
        'remote.origin.fetch'
      ];

      const lines: string[] = [];

      for (const key of commonKeys) {
        try {
          const value = await this.git.getConfig({

            dir: global ? undefined : this.pwd,
            path: key,
          });
          if (value !== undefined) {
            lines.push(`${key}=${value}`);
          }
        } catch {
          // Skip if config doesn't exist
        }
      }

      return createSuccessResult(lines.join('\n') + (lines.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`Failed to list config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getConfig(key: string, global: boolean): Promise<ShellCommandResult> {
    try {
      const value = await this.git.getConfig({

        dir: global ? undefined : this.pwd,
        path: key,
      });

      if (value === undefined) {
        return createErrorResult(`error: key does not exist: ${key}`);
      }

      return createSuccessResult(value + '\n');

    } catch (error) {
      return createErrorResult(`Failed to get config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setConfig(key: string, value: string, global: boolean): Promise<ShellCommandResult> {
    try {
      await this.git.setConfig({
        dir: global ? undefined : this.pwd,
        path: key,
        value: value,
      });

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`Failed to set config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}