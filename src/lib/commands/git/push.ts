import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import type { NostrSigner } from "@nostrify/nostrify";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { findCredentialsForRepo } from "@/lib/gitCredentials";
import { readGitSettings } from "@/lib/configUtils";

export class GitPushCommand implements GitSubcommand {
  name = 'push';
  description = 'Update remote refs along with associated objects';
  usage = 'git push [<remote>] [<branch>]';

  private git: Git;
  private fs: JSRuntimeFS;
  private pwd: string;
  private signer?: NostrSigner;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
    this.pwd = options.pwd;
    this.signer = options.signer;
  }

  async execute(args: string[]): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await this.fs.stat(`${this.pwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { remote, branch, options } = this.parseArgs(args);

      // Get current branch if not specified
      let targetBranch = branch;
      if (!targetBranch) {
        try {
          targetBranch = await this.git.currentBranch({

            dir: this.pwd,
          }) || undefined;
          if (!targetBranch) {
            return createErrorResult('fatal: You are not currently on a branch.');
          }
        } catch {
          return createErrorResult('fatal: You are not currently on a branch.');
        }
      }

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

      const settings = await readGitSettings(this.fs);

      try {
        await this.git.push({
          dir: this.pwd,
          remote: remote,
          ref: targetBranch,
          remoteRef: targetBranch,
          force: options.force,
          onAuth: (url) => findCredentialsForRepo(url, settings.credentials),
          signer: this.signer,
        });

        return createSuccessResult(`To ${remoteUrl}\n   ${targetBranch} -> ${targetBranch}\n`);

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('authentication')) {
            return createErrorResult('fatal: Authentication failed. Please configure git credentials.');
          } else if (error.message.includes('rejected') || error.message.includes('Updates were rejected')) {
            return createErrorResult(`error: failed to push some refs to '${remoteUrl}'\nhint: ${error.message}`);
          } else if (error.message.includes('network')) {
            return createErrorResult('fatal: unable to access remote repository. Please check your network connection.');
          } else if (error.message.includes('Nostr signer is required')) {
            return createErrorResult('fatal: Nostr signer is required for pushing to Nostr repositories. Please log in with a Nostr account.');
          } else if (error.message.includes('Everything up-to-date')) {
            return createSuccessResult('Everything up-to-date\n');
          }
        }

        return createErrorResult(`Failed to push: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      return createErrorResult(`git push: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    remote: string;
    branch?: string;
    options: { force: boolean; setUpstream: boolean }
  } {
    const options = { force: false, setUpstream: false };
    let remote = 'origin'; // Default remote
    let branch: string | undefined;
    const positionalArgs: string[] = [];

    // First, collect all non-option arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--force' || arg === '-f') {
        options.force = true;
      } else if (arg === '--set-upstream' || arg === '-u') {
        options.setUpstream = true;
      } else if (!arg.startsWith('-')) {
        positionalArgs.push(arg);
      }
    }

    // Parse positional arguments: [remote] [branch]
    if (positionalArgs.length >= 1) {
      remote = positionalArgs[0];
    }
    if (positionalArgs.length >= 2) {
      branch = positionalArgs[1];
    }

    return { remote, branch, options };
  }
}