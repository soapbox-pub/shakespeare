import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitInitCommand implements GitSubcommand {
  name = 'init';
  description = 'Create an empty Git repository or reinitialize an existing one';
  usage = 'git init [--bare] [<directory>]';

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
      // Parse arguments
      const { options, directory } = this.parseArgs(args);
      const targetDir = directory || this.pwd;

      // Check if directory exists, create if needed
      if (directory) {
        try {
          await this.fs.stat(targetDir);
        } catch {
          // Directory doesn't exist, create it
          await this.fs.mkdir(targetDir, { recursive: true });
        }
      }

      // Check if already a git repository
      try {
        await this.fs.stat(`${targetDir}/.git`);
        return createSuccessResult(`Reinitialized existing Git repository in ${targetDir}/.git/\n`);
      } catch {
        // Not a git repository, proceed with initialization
      }

      // Initialize the repository
      await this.git.init({
        dir: targetDir,
        bare: options.bare,
        defaultBranch: 'main'
      });

      // Set up basic configuration
      await this.git.setConfig({
        dir: targetDir,
        path: 'user.name',
        value: 'shakespeare.diy'
      });

      await this.git.setConfig({
        dir: targetDir,
        path: 'user.email',
        value: 'assistant@shakespeare.diy'
      });

      const message = options.bare
        ? `Initialized empty Git repository in ${targetDir}/\n`
        : `Initialized empty Git repository in ${targetDir}/.git/\n`;

      return createSuccessResult(message);

    } catch (error) {
      return createErrorResult(`git init: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { options: { bare: boolean }; directory?: string } {
    const options = { bare: false };
    let directory: string | undefined;

    for (const arg of args) {
      if (arg === '--bare') {
        options.bare = true;
      } else if (!arg.startsWith('-')) {
        directory = arg;
      }
    }

    return { options, directory };
  }
}