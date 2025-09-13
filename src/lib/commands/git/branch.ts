import git from 'isomorphic-git';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitBranchCommand implements GitSubcommand {
  name = 'branch';
  description = 'List, create, or delete branches';
  usage = 'git branch [--list] | git branch <branchname> | git branch (-d | -D) <branchname>';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { action, branchName, options } = this.parseArgs(args);

      switch (action) {
        case 'list':
          return await this.listBranches(fs, cwd);
        case 'create':
          return await this.createBranch(fs, cwd, branchName!);
        case 'delete':
          return await this.deleteBranch(fs, cwd, branchName!, options.force);
        default:
          return await this.listBranches(fs, cwd);
      }

    } catch (error) {
      return createErrorResult(`git branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    action: 'list' | 'create' | 'delete';
    branchName?: string;
    options: { force: boolean }
  } {
    const options = { force: false };
    let action: 'list' | 'create' | 'delete' = 'list';
    let branchName: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--list' || arg === '-l') {
        action = 'list';
      } else if (arg === '-d' || arg === '--delete') {
        action = 'delete';
        if (i + 1 < args.length) {
          branchName = args[i + 1];
          i++;
        }
      } else if (arg === '-D') {
        action = 'delete';
        options.force = true;
        if (i + 1 < args.length) {
          branchName = args[i + 1];
          i++;
        }
      } else if (!arg.startsWith('-')) {
        // Branch name for creation
        action = 'create';
        branchName = arg;
      }
    }

    return { action, branchName, options };
  }

  private async listBranches(fs: JSRuntimeFS, cwd: string): Promise<ShellCommandResult> {
    try {
      const branches = await git.listBranches({
        fs,
        dir: cwd,
      });

      if (branches.length === 0) {
        return createSuccessResult('');
      }

      // Get current branch
      let currentBranch: string | null = null;
      try {
        currentBranch = await git.currentBranch({
          fs,
          dir: cwd,
        }) || null;
      } catch {
        // Might be in detached HEAD state
      }

      const lines: string[] = [];
      for (const branch of branches) {
        if (branch === currentBranch) {
          lines.push(`* ${branch}`);
        } else {
          lines.push(`  ${branch}`);
        }
      }

      return createSuccessResult(lines.join('\n') + '\n');

    } catch (error) {
      return createErrorResult(`Failed to list branches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createBranch(fs: JSRuntimeFS, cwd: string, branchName: string): Promise<ShellCommandResult> {
    try {
      // Check if branch already exists
      const branches = await git.listBranches({
        fs,
        dir: cwd,
      });

      if (branches.includes(branchName)) {
        return createErrorResult(`fatal: A branch named '${branchName}' already exists.`);
      }

      // Get current HEAD to base the new branch on
      let currentRef: string;
      try {
        currentRef = await git.resolveRef({
          fs,
          dir: cwd,
          ref: 'HEAD',
        });
      } catch {
        return createErrorResult('fatal: Not a valid object name: \'HEAD\'.');
      }

      // Create the new branch
      await git.branch({
        fs,
        dir: cwd,
        ref: branchName,
        object: currentRef,
      });

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async deleteBranch(fs: JSRuntimeFS, cwd: string, branchName: string, force: boolean): Promise<ShellCommandResult> {
    try {
      // Check if branch exists
      const branches = await git.listBranches({
        fs,
        dir: cwd,
      });

      if (!branches.includes(branchName)) {
        return createErrorResult(`error: branch '${branchName}' not found.`);
      }

      // Check if it's the current branch
      let currentBranch: string | null = null;
      try {
        currentBranch = await git.currentBranch({
          fs,
          dir: cwd,
        }) || null;
      } catch {
        // Continue
      }

      if (currentBranch === branchName) {
        return createErrorResult(`error: Cannot delete branch '${branchName}' checked out at '${cwd}'`);
      }

      // Delete the branch
      await git.deleteBranch({
        fs,
        dir: cwd,
        ref: branchName,
      });

      return createSuccessResult(`Deleted branch ${branchName}.\n`);

    } catch (error) {
      if (!force && error instanceof Error && error.message.includes('not fully merged')) {
        return createErrorResult(`error: The branch '${branchName}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${branchName}'.`);
      }
      return createErrorResult(`Failed to delete branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}