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
import { GitCloneCommand } from "./git/clone";
import { GitConfigCommand } from "./git/config";
import { GitResetCommand } from "./git/reset";
import { GitDiffCommand } from "./git/diff";
import { GitTagCommand } from "./git/tag";
import { GitShowCommand } from "./git/show";

export interface GitSubcommand {
  name: string;
  description: string;
  usage: string;
  execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult>;
}

/**
 * Implementation of the 'git' command
 * Git version control system
 */
export class GitCommand implements ShellCommand {
  name = 'git';
  description = 'Git version control system';
  usage = 'git <command> [<args>]';

  private fs: JSRuntimeFS;
  private subcommands: Map<string, GitSubcommand>;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
    this.subcommands = new Map();
    
    // Register all subcommands
    this.registerSubcommand(new GitInitCommand());
    this.registerSubcommand(new GitStatusCommand());
    this.registerSubcommand(new GitAddCommand());
    this.registerSubcommand(new GitCommitCommand());
    this.registerSubcommand(new GitLogCommand());
    this.registerSubcommand(new GitBranchCommand());
    this.registerSubcommand(new GitCheckoutCommand());
    this.registerSubcommand(new GitRemoteCommand());
    this.registerSubcommand(new GitPushCommand());
    this.registerSubcommand(new GitPullCommand());
    this.registerSubcommand(new GitCloneCommand());
    this.registerSubcommand(new GitConfigCommand());
    this.registerSubcommand(new GitResetCommand());
    this.registerSubcommand(new GitDiffCommand());
    this.registerSubcommand(new GitTagCommand());
    this.registerSubcommand(new GitShowCommand());
  }

  private registerSubcommand(subcommand: GitSubcommand): void {
    this.subcommands.set(subcommand.name, subcommand);
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
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
      return await subcommand.execute(subcommandArgs, cwd, this.fs);

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