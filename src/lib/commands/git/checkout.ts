import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitCheckoutCommand implements GitSubcommand {
  name = 'checkout';
  description = 'Switch branches or restore working tree files';
  usage = 'git checkout <branch> | git checkout -b <new-branch> | git checkout -- <file>';

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

      const { action, target } = this.parseArgs(args);

      switch (action) {
        case 'switch':
          return await this.switchBranch(target!, cwd);
        case 'create':
          return await this.createAndSwitchBranch(target!, cwd);
        case 'restore':
          return await this.restoreFiles(target!, cwd);
        default:
          return createErrorResult('error: pathspec did not match any file(s) known to git');
      }

    } catch (error) {
      return createErrorResult(`git checkout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    action: 'switch' | 'create' | 'restore';
    target?: string;
    options: { createBranch: boolean }
  } {
    const options = { createBranch: false };
    let action: 'switch' | 'create' | 'restore' = 'switch';
    let target: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-b') {
        action = 'create';
        options.createBranch = true;
        if (i + 1 < args.length) {
          target = args[i + 1];
          i++;
        }
      } else if (arg === '--') {
        // Everything after -- is a file path
        if (i + 1 < args.length) {
          action = 'restore';
          target = args[i + 1];
        }
        break;
      } else if (!arg.startsWith('-')) {
        if (!target) {
          target = arg;
        }
      }
    }

    return { action, target, options };
  }

  private async  switchBranch(branchName: string, cwd: string): Promise<ShellCommandResult>  {
    try {
      // Check if branch exists
      const branches = await this.git.listBranches({
        dir: cwd,
      });

      if (!branches.includes(branchName)) {
        return createErrorResult(`error: pathspec '${branchName}' did not match any file(s) known to git`);
      }

      // Get current branch
      let currentBranch: string | null = null;
      try {
        currentBranch = await this.git.currentBranch({
          dir: cwd,
        }) || null;
      } catch {
        // Continue
      }

      if (currentBranch === branchName) {
        return createErrorResult(`Already on '${branchName}'`);
      }

      // Check for uncommitted changes
      const statusMatrix = await this.git.statusMatrix({
        dir: cwd,
      });

      const hasChanges = statusMatrix.some(([, headStatus, workdirStatus, stageStatus]) => {
        return headStatus !== workdirStatus || headStatus !== stageStatus;
      });

      if (hasChanges) {
        return createErrorResult('error: Your local changes to the following files would be overwritten by checkout:\nPlease commit your changes or stash them before you switch branches.');
      }

      // Switch to the branch
      await this.git.checkout({
        dir: cwd,
        ref: branchName,
      });

      return createSuccessResult(`Switched to branch '${branchName}'\n`);

    } catch (error) {
      return createErrorResult(`Failed to switch branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  createAndSwitchBranch(branchName: string, cwd: string): Promise<ShellCommandResult>  {
    try {
      // Check if branch already exists
      const branches = await this.git.listBranches({
        dir: cwd,
      });

      if (branches.includes(branchName)) {
        return createErrorResult(`fatal: A branch named '${branchName}' already exists.`);
      }

      // Get current HEAD
      let currentRef: string;
      try {
        currentRef = await this.git.resolveRef({
          dir: cwd,
          ref: 'HEAD',
        });
      } catch {
        return createErrorResult('fatal: Not a valid object name: \'HEAD\'.');
      }

      // Create the branch
      await this.git.branch({
        dir: cwd,
        ref: branchName,
        object: currentRef,
      });

      // Switch to the new branch
      await this.git.checkout({
        dir: cwd,
        ref: branchName,
      });

      return createSuccessResult(`Switched to a new branch '${branchName}'\n`);

    } catch (error) {
      return createErrorResult(`Failed to create and switch branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  restoreFiles(filePath: string, cwd: string): Promise<ShellCommandResult>  {
    try {
      // This is a simplified implementation
      // In a full git implementation, this would restore files from the index or HEAD

      // Get the file from HEAD
      try {
        await this.git.checkout({
          dir: cwd,
          ref: 'HEAD',
          filepaths: [filePath],
        });

        return createSuccessResult('');
      } catch (error) {
        if (error instanceof Error && error.message.includes('does not exist')) {
          return createErrorResult(`error: pathspec '${filePath}' did not match any file(s) known to git`);
        }
        throw error;
      }

    } catch (error) {
      return createErrorResult(`Failed to restore file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
