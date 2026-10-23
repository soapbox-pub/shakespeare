import type { Git } from "../git";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import type { NostrSigner } from "@nostrify/nostrify";
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
import { GitRmCommand } from "./git/rm";
import { GitMvCommand } from "./git/mv";
import { GitRestoreCommand } from "./git/restore";
import { GitSwitchCommand } from "./git/switch";
import { GitMergeCommand } from "./git/merge";
import { GitRevertCommand } from "./git/revert";
import { GitRevParseCommand } from "./git/rev-parse";
import { GitLsFilesCommand } from "./git/ls-files";
import { GitCleanCommand } from "./git/clean";
import { GitGrepCommand } from "./git/grep";
import { GitBlameCommand } from "./git/blame";
import { GitDescribeCommand } from "./git/describe";
import { GitShortlogCommand } from "./git/shortlog";
import { GitCherryPickCommand } from "./git/cherry-pick";
import { GitCatFileCommand } from "./git/cat-file";
import { GitLsTreeCommand } from "./git/ls-tree";
import { GitMergeBaseCommand } from "./git/merge-base";
import { GitRevListCommand } from "./git/rev-list";

export interface GitSubcommand {
  name: string;
  description: string;
  usage: string;
  execute(args: string[], cwd: string): Promise<ShellCommandResult>;
}

export interface GitSubcommandOptions {
  git: Git;
  fs: JSRuntimeFS;
  signer?: NostrSigner;
}

export interface GitCommandOptions {
  git: Git;
  fs: JSRuntimeFS;
  cwd: string;
  signer?: NostrSigner;
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
  private signer?: NostrSigner;
  private subcommands: Map<string, GitSubcommand>;

  constructor(options: GitCommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
    this.cwd = options.cwd;
    this.signer = options.signer;
    this.subcommands = new Map();

    // Register all subcommands
    const subcommandOptions: GitSubcommandOptions = {
      git: this.git,
      fs: this.fs,
      signer: this.signer,
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
    this.registerSubcommand(new GitRmCommand(subcommandOptions));
    this.registerSubcommand(new GitMvCommand(subcommandOptions));
    this.registerSubcommand(new GitRestoreCommand(subcommandOptions));
    this.registerSubcommand(new GitSwitchCommand(subcommandOptions));
    this.registerSubcommand(new GitMergeCommand(subcommandOptions));
    this.registerSubcommand(new GitRevertCommand(subcommandOptions));
    this.registerSubcommand(new GitRevParseCommand(subcommandOptions));
    this.registerSubcommand(new GitLsFilesCommand(subcommandOptions));
    this.registerSubcommand(new GitCleanCommand(subcommandOptions));
    this.registerSubcommand(new GitGrepCommand(subcommandOptions));
    this.registerSubcommand(new GitBlameCommand(subcommandOptions));
    this.registerSubcommand(new GitDescribeCommand(subcommandOptions));
    this.registerSubcommand(new GitShortlogCommand(subcommandOptions));
    this.registerSubcommand(new GitCherryPickCommand(subcommandOptions));
    this.registerSubcommand(new GitCatFileCommand(subcommandOptions));
    this.registerSubcommand(new GitLsTreeCommand(subcommandOptions));
    this.registerSubcommand(new GitMergeBaseCommand(subcommandOptions));
    this.registerSubcommand(new GitRevListCommand(subcommandOptions));
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

      // Execute the subcommand, passing the current working directory
      // This ensures git commands use the correct directory after 'cd' commands
      return await subcommand.execute(subcommandArgs, cwd);

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
   clean      Remove untracked files from the working tree
   mv         Move or rename a file, a directory, or a symlink
   restore    Restore working tree files
   rm         Remove files from the working tree and from the index
   reset      Reset current HEAD to the specified state
   stash      Stash the changes in a dirty working directory away

examine the history and state (see also: git help revisions)
   blame      Show what revision and author last modified each line of a file
   describe   Give an object a human readable name based on an available ref
   diff       Show changes between commits, commit and working tree, etc
   grep       Print lines matching a pattern
   log        Show commit logs
   ls-files   Show information about files in the index and the working tree
   shortlog   Summarize git log output
   show       Show various types of objects
   status     Show the working tree status

grow, mark and tweak your common history
   branch     List, create, or delete branches
   cherry-pick  Apply the changes introduced by some existing commits
   checkout   Switch branches or restore working tree files
   commit     Record changes to the repository
   merge      Join two or more development histories together
   rebase     Reapply commits on top of another base tip (not implemented)
   revert     Revert some existing commits
   switch     Switch branches
   tag        Create, list, delete or verify a tag object

collaborate (see also: git help workflows)
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects
   remote     Manage set of tracked repositories

configuration and low-level
   config     Get and set repository or global options
   cat-file   Provide contents or details of repository objects
   ls-tree    List the contents of a tree object
   merge-base Find as good common ancestors as possible for a merge
   rev-list   Lists commit objects in reverse chronological order
   rev-parse  Pick out and massage parameters

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
`;

    return createSuccessResult(helpText);
  }
}