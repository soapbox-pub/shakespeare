import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitFetchCommand implements GitSubcommand {
  name = 'fetch';
  description = 'Download objects and refs from another repository';
  usage = 'git fetch [<remote>] [<refspec>...]';

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

      const { remote, refs } = this.parseArgs(args);

      // Get remote URL
      let remoteUrl: string;
      try {
        const remotes = await this.git.listRemotes({
          dir: this.pwd,
        });

        const targetRemote = remotes.find(r => r.remote === remote);
        if (!targetRemote) {
          return createErrorResult(`fatal: '${remote}' does not appear to be a git repository`);
        }
        remoteUrl = targetRemote.url;
      } catch {
        return createErrorResult(`fatal: '${remote}' does not appear to be a git repository`);
      }

      try {
        // If specific refs are provided, fetch them; otherwise fetch all refs
        if (refs.length > 0) {
          // Fetch specific refs
          for (const ref of refs) {
            await this.git.fetch({
              dir: this.pwd,
              remote: remote,
              ref: ref,
            });
          }
        } else {
          // Fetch all refs (default behavior)
          await this.git.fetch({
            dir: this.pwd,
            remote: remote,
          });
        }

        // Build output message
        const lines: string[] = [];
        lines.push(`From ${remoteUrl}`);

        if (refs.length > 0) {
          // Show specific refs that were fetched
          for (const ref of refs) {
            try {
              await this.git.resolveRef({
                dir: this.pwd,
                ref: `refs/remotes/${remote}/${ref}`,
              });
              lines.push(` * branch            ${ref}     -> ${remote}/${ref}`);
            } catch {
              // If we can't resolve the ref, it might be a tag or other ref type
              lines.push(` * [new ref]         ${ref}     -> ${remote}/${ref}`);
            }
          }
        } else {
          // For fetch without specific refs, we'll show a generic message
          lines.push(` * [new refs]        refs/heads/* -> refs/remotes/${remote}/*`);
        }

        return createSuccessResult(lines.join('\n') + '\n');

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('authentication')) {
            return createErrorResult('fatal: Authentication failed. Please configure git credentials.');
          } else if (error.message.includes('network')) {
            return createErrorResult('fatal: unable to access remote repository. Please check your network connection.');
          } else if (error.message.includes('not found')) {
            return createErrorResult(`fatal: remote ref not found`);
          }
        }

        return createErrorResult(`Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      return createErrorResult(`git fetch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    remote: string;
    refs: string[];
    options: {
      all: boolean;
      tags: boolean;
      prune: boolean;
      verbose: boolean;
    }
  } {
    let remote = 'origin'; // Default remote
    const refs: string[] = [];
    const options = {
      all: false,
      tags: false,
      prune: false,
      verbose: false,
    };

    const nonOptionArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('-')) {
        // Handle options
        switch (arg) {
          case '--all':
            options.all = true;
            break;
          case '--tags':
            options.tags = true;
            break;
          case '--prune':
          case '-p':
            options.prune = true;
            break;
          case '--verbose':
          case '-v':
            options.verbose = true;
            break;
          default:
            // Ignore unknown options for now
            break;
        }
      } else {
        nonOptionArgs.push(arg);
      }
    }

    // Parse non-option arguments
    if (nonOptionArgs.length >= 1) {
      remote = nonOptionArgs[0];
    }
    if (nonOptionArgs.length >= 2) {
      // All remaining args are refs/refspecs
      refs.push(...nonOptionArgs.slice(1));
    }

    return { remote, refs, options };
  }
}