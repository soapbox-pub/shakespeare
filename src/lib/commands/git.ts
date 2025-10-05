import type { Git } from "../git";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

// Import subcommands
import { GitInitCommand } from "./git/init";
import { GitStatusCommand } from "./git/status";
import { GitAddCommand } from "./git/add";
import { GitCommitCommand } from "./git/commit";
import { GitLogCommand } from "./git/log";
import { GitBranchCommand } from "./git/branch";
import { GitCheckoutCommand } from "./git/checkout";
import { GitRemoteCommand } from "./git/remote";
import { GitPushCommand } from "./git/push";
import { GitPullCommand } from "./git/pull";
import { GitFetchCommand } from "./git/fetch";
import { GitCloneCommand } from "./git/clone";
import { GitConfigCommand } from "./git/config";
import { GitResetCommand } from "./git/reset";
import { GitDiffCommand } from "./git/diff";
import { GitTagCommand } from "./git/tag";
import { GitShowCommand } from "./git/show";
import { GitStashCommand } from "./git/stash";

export interface GitSubcommand {
  name: string;
  description: string;
  usage: string;
  execute(args: string[]): Promise<ShellCommandResult>;
}

export interface GitSubcommandOptions {
  git: Git;
  fs: JSRuntimeFS;
  pwd: string;
}

export interface GitCommandOptions {
  git: Git;
  fs: JSRuntimeFS;
  cwd: string;
}

/**
 * Implementation of the 'git' command
 * Git version control system
 */
export class GitCommand implements ShellCommand {
  name = 'git';
  description = 'Git version control system';
  usage = 'git <command> [<args>]';

  private git: Git;
  private fs: JSRuntimeFS;
  private cwd: string;
  private subcommands: Map<string, GitSubcommand>;

  constructor(options: GitCommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
    this.cwd = options.cwd;
    this.subcommands = new Map();

    // Register all subcommands
    const subcommandOptions: GitSubcommandOptions = {
      git: this.git,
      fs: this.fs,
      pwd: this.cwd,
    };

    this.registerSubcommand(new GitInitCommand(subcommandOptions));
    this.registerSubcommand(new GitStatusCommand(subcommandOptions));
    this.registerSubcommand(new GitAddCommand(subcommandOptions));
    this.registerSubcommand(new GitCommitCommand(subcommandOptions));
    this.registerSubcommand(new GitLogCommand(subcommandOptions));
    this.registerSubcommand(new GitBranchCommand(subcommandOptions));
    this.registerSubcommand(new GitCheckoutCommand(subcommandOptions));
    this.registerSubcommand(new GitRemoteCommand(subcommandOptions));
    this.registerSubcommand(new GitPushCommand(subcommandOptions));
    this.registerSubcommand(new GitPullCommand(subcommandOptions));
    this.registerSubcommand(new GitFetchCommand(subcommandOptions));
    this.registerSubcommand(new GitCloneCommand(subcommandOptions));
    this.registerSubcommand(new GitConfigCommand(subcommandOptions));
    this.registerSubcommand(new GitResetCommand(subcommandOptions));
    this.registerSubcommand(new GitDiffCommand(subcommandOptions));
    this.registerSubcommand(new GitTagCommand(subcommandOptions));
    this.registerSubcommand(new GitShowCommand(subcommandOptions));
    this.registerSubcommand(new GitStashCommand(subcommandOptions));
  }

  private registerSubcommand(subcommand: GitSubcommand): void {
    this.subcommands.set(subcommand.name, subcommand);
  }

  async execute(args: string[], _cwd: string, _input?: string): Promise<ShellCommandResult> {
    try {
      // Handle no arguments or help
      if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        return this.showHelp();
      }

      // Handle version
      if (args[0] === '--version') {
        return createSuccessResult('git version 1.32.1 (isomorphic-git)\n');
      }

      const subcommandName = args[0];
      const subcommandArgs = args.slice(1);

      // Find the subcommand
      const subcommand = this.subcommands.get(subcommandName);
      if (!subcommand) {
        return createErrorResult(`git: '${subcommandName}' is not a git command. See 'git --help'.`);
      }

      // Execute the subcommand
      return await subcommand.execute(subcommandArgs);

    } catch (error) {
      return createErrorResult(`git: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private showHelp(): ShellCommandResult {
    const helpText = `usage: git [--version] [--help] <command> [<args>]

These are common Git commands used in various situations:

start a working area (see also: git help tutorial)
   clone      Clone a repository into a new directory
   init       Create an empty Git repository or reinitialize an existing one

work on the current change (see also: git help everyday)
   add        Add file contents to the index
   reset      Reset current HEAD to the specified state
   stash      Stash the changes in a dirty working directory away

examine the history and state (see also: git help revisions)
   log        Show commit logs
   show       Show various types of objects
   status     Show the working tree status
   diff       Show changes between commits, commit and working tree, etc

grow, mark and tweak your common history
   branch     List, create, or delete branches
   checkout   Switch branches or restore working tree files
   commit     Record changes to the repository
   tag        Create, list, delete or verify a tag object

collaborate (see also: git help workflows)
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects
   remote     Manage set of tracked repositories

configuration
   config     Get and set repository or global options

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
`;

    return createSuccessResult(helpText);
  }
}