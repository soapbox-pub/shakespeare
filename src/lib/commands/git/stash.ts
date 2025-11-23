import { join } from "path-browserify";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

interface StashEntry {
  message: string;
  branch: string;
  timestamp: number;
  files: Array<{
    filepath: string;
    content: string;
    status: 'modified' | 'added' | 'deleted';
  }>;
  stagedFiles: string[];
}

export class GitStashCommand implements GitSubcommand {
  name = 'stash';
  description = 'Stash the changes in a dirty working directory away';
  usage = 'git stash [push | list | apply | pop | drop | clear | show] [<options>]';

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

      const subcommand = args[0] || 'push';
      const subcommandArgs = args.slice(1);

      switch (subcommand) {
        case 'push':
        case 'save':
          return await this.stashPush(subcommandArgs, cwd);
        case 'list':
          return await this.stashList(cwd);
        case 'apply':
          return await this.stashApply(subcommandArgs, cwd);
        case 'pop':
          return await this.stashPop(subcommandArgs, cwd);
        case 'drop':
          return await this.stashDrop(subcommandArgs, cwd);
        case 'clear':
          return await this.stashClear(cwd);
        case 'show':
          return await this.stashShow(subcommandArgs, cwd);
        case '--help':
        case '-h':
          return this.showHelp(cwd);
        default:
          // If first arg doesn't look like a subcommand, treat it as 'push'
          if (subcommand.startsWith('-')) {
            return await this.stashPush(args, cwd);
          }
          return createErrorResult(`git stash: '${subcommand}' is not a stash command. See 'git stash --help'.`);
      }

    } catch (error) {
      return createErrorResult(`git stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashPush(args: string[], cwd: string): Promise<ShellCommandResult>  {
    try {
      // Parse arguments
      let message = 'WIP on';
      let includeUntracked = false;

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-m' || args[i] === '--message') {
          if (i + 1 < args.length) {
            message = args[i + 1];
            i++;
          }
        } else if (args[i] === '-u' || args[i] === '--include-untracked') {
          includeUntracked = true;
        }
      }

      // Get current branch
      let currentBranch: string | null = null;
      try {
        currentBranch = await this.git.currentBranch({ dir: cwd }) || null;
      } catch {
        currentBranch = 'HEAD';
      }

      // Get status to find changed files
      const statusMatrix = await this.git.statusMatrix({ dir: cwd });

      const filesToStash: StashEntry['files'] = [];
      const stagedFiles: string[] = [];

      for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
        try {
          // Track staged files
          if (headStatus !== stageStatus) {
            stagedFiles.push(filepath);
          }

          const hasWorkdirChanges = stageStatus !== workdirStatus;
          const hasStagedChanges = headStatus !== stageStatus;
          
          // Skip if no changes at all
          if (!hasWorkdirChanges && !hasStagedChanges) {
            continue;
          }

          // Untracked files (only with -u flag)
          if (includeUntracked && headStatus === 0 && stageStatus === 0 && workdirStatus === 2) {
            const content = await this.fs.readFile(join(cwd, filepath), 'utf8');
            filesToStash.push({
              filepath,
              content,
              status: 'added',
            });
          }
          // Deleted files (deleted in working dir)
          else if (workdirStatus === 0 && (stageStatus === 1 || stageStatus === 2)) {
            filesToStash.push({
              filepath,
              content: '',
              status: 'deleted',
            });
          }
          // Staged new files or modified files (staged changes)
          else if (hasStagedChanges && workdirStatus === 2) {
            const content = await this.fs.readFile(join(cwd, filepath), 'utf8');
            const status = headStatus === 0 ? 'added' : 'modified';
            filesToStash.push({
              filepath,
              content,
              status,
            });
          }
          // Unstaged modifications in working directory
          else if (hasWorkdirChanges && workdirStatus === 2) {
            const content = await this.fs.readFile(join(cwd, filepath), 'utf8');
            filesToStash.push({
              filepath,
              content,
              status: 'modified',
            });
          }
        } catch (error) {
          console.warn(`Failed to process ${filepath}:`, error);
        }
      }

      if (filesToStash.length === 0) {
        return createErrorResult('No local changes to save');
      }

      // Create stash entry
      const stashEntry: StashEntry = {
        message: message === 'WIP on' ? `WIP on ${currentBranch}` : message,
        branch: currentBranch || 'HEAD',
        timestamp: Date.now(),
        files: filesToStash,
        stagedFiles,
      };

      // Save stash
      await this.saveStash(stashEntry, cwd);

      // Revert changes in working directory
      for (const file of filesToStash) {
        try {
          if (file.status === 'deleted') {
            // Restore deleted file from HEAD
            await this.git.checkout({
              dir: cwd,
              filepaths: [file.filepath],
              force: true,
            });
          } else if (file.status === 'modified') {
            // Restore file from HEAD using checkout
            await this.git.checkout({
              dir: cwd,
              filepaths: [file.filepath],
              force: true,
            });
          } else if (file.status === 'added') {
            // Delete new file (it doesn't exist in HEAD)
            try {
              await this.fs.unlink(join(cwd, file.filepath));
            } catch {
              // File might already be gone
            }
          }
        } catch (error) {
          console.warn(`Failed to revert ${file.filepath}:`, error);
        }
      }

      // Clear staging area
      for (const file of stagedFiles) {
        try {
          await this.git.resetIndex({
            dir: cwd,
            filepath: file,
          });
        } catch {
          // Continue if reset fails
        }
      }

      return createSuccessResult(`Saved working directory and index state ${stashEntry.message}\n`);

    } catch (error) {
      return createErrorResult(`Failed to stash changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashList(cwd: string): Promise<ShellCommandResult>  {
    try {
      const stashes = await this.loadStashes(cwd);

      if (stashes.length === 0) {
        return createSuccessResult('');
      }

      const lines = stashes.map((stash, index) => {
        return `stash@{${index}}: ${stash.message}`;
      });

      return createSuccessResult(lines.join('\n') + '\n');

    } catch (error) {
      return createErrorResult(`Failed to list stashes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashApply(args: string[], cwd: string): Promise<ShellCommandResult>  {
    try {
      const stashes = await this.loadStashes(cwd);
      
      if (stashes.length === 0) {
        return createErrorResult('No stash entries found.');
      }

      // Parse stash reference (e.g., stash@{0} or just 0)
      const stashRef = args[0] || 'stash@{0}';
      const index = this.parseStashRef(stashRef, cwd);

      if (index < 0 || index >= stashes.length) {
        return createErrorResult(`stash@{${index}} is not a valid reference`);
      }

      const stash = stashes[index];

      // Apply stashed changes
      for (const file of stash.files) {
        try {
          if (file.status === 'deleted') {
            // Delete the file
            try {
              await this.fs.unlink(join(cwd, file.filepath));
            } catch {
              // File might not exist
            }
          } else {
            // Create file with stashed content
            const dir = join(cwd, file.filepath, '..');
            try {
              await this.fs.mkdir(dir, { recursive: true });
            } catch {
              // Directory might exist
            }
            await this.fs.writeFile(join(cwd, file.filepath), file.content);
          }
        } catch (error) {
          console.warn(`Failed to apply ${file.filepath}:`, error);
        }
      }

      // Restore staging area
      for (const filepath of stash.stagedFiles) {
        try {
          await this.git.add({
            dir: cwd,
            filepath,
          });
        } catch {
          // Continue if add fails
        }
      }

      return createSuccessResult(`On branch ${stash.branch}: ${stash.message}\n`);

    } catch (error) {
      return createErrorResult(`Failed to apply stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashPop(args: string[], cwd: string): Promise<ShellCommandResult>  {
    try {
      // Apply the stash first
      const result = await this.stashApply(args, cwd);

      if (result.exitCode !== 0) {
        return result;
      }

      // If apply succeeded, drop the stash
      const dropResult = await this.stashDrop(args, cwd);

      if (dropResult.exitCode !== 0) {
        return createErrorResult(`Applied stash successfully but failed to drop: ${dropResult.stderr}`);
      }

      return result;

    } catch (error) {
      return createErrorResult(`Failed to pop stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashDrop(args: string[], cwd: string): Promise<ShellCommandResult>  {
    try {
      const stashes = await this.loadStashes(cwd);

      if (stashes.length === 0) {
        return createErrorResult('No stash entries found.');
      }

      // Parse stash reference
      const stashRef = args[0] || 'stash@{0}';
      const index = this.parseStashRef(stashRef, cwd);

      if (index < 0 || index >= stashes.length) {
        return createErrorResult(`stash@{${index}} is not a valid reference`);
      }

      // Remove the stash
      stashes.splice(index, 1);
      await this.saveStashes(stashes, cwd);

      return createSuccessResult(`Dropped stash@{${index}}\n`);

    } catch (error) {
      return createErrorResult(`Failed to drop stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashClear(cwd: string): Promise<ShellCommandResult>  {
    try {
      await this.saveStashes([], cwd);
      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`Failed to clear stashes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async  stashShow(args: string[], cwd: string): Promise<ShellCommandResult>  {
    try {
      const stashes = await this.loadStashes(cwd);

      if (stashes.length === 0) {
        return createErrorResult('No stash entries found.');
      }

      // Parse stash reference
      const stashRef = args[0] || 'stash@{0}';
      const index = this.parseStashRef(stashRef, cwd);

      if (index < 0 || index >= stashes.length) {
        return createErrorResult(`stash@{${index}} is not a valid reference`);
      }

      const stash = stashes[index];
      const lines: string[] = [];

      // Show file changes
      for (const file of stash.files) {
        const status = file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M';
        lines.push(`${status}\t${file.filepath}`);
      }

      if (lines.length === 0) {
        lines.push('No changes in stash');
      }

      return createSuccessResult(lines.join('\n') + '\n');

    } catch (error) {
      return createErrorResult(`Failed to show stash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private  parseStashRef(ref: string, _cwd: string): number  {
    // Parse stash@{N} or just N
    const match = ref.match(/^(?:stash@\{)?(\d+)\}?$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0; // Default to stash@{0}
  }

  private async  loadStashes(cwd: string): Promise<StashEntry[]>  {
    try {
      const stashPath = join(cwd, '.git', 'shakespeare_stash.json');
      const data = await this.fs.readFile(stashPath, 'utf8');
      return JSON.parse(data) as StashEntry[];
    } catch {
      return [];
    }
  }

  private async  saveStash(stash: StashEntry, cwd: string): Promise<void>  {
    const stashes = await this.loadStashes(cwd);
    stashes.unshift(stash); // Add to beginning of array
    await this.saveStashes(stashes, cwd);
  }

  private async  saveStashes(stashes: StashEntry[], cwd: string): Promise<void>  {
    const stashPath = join(cwd, '.git', 'shakespeare_stash.json');
    await this.fs.writeFile(stashPath, JSON.stringify(stashes, null, 2));
  }

  private  showHelp(_cwd: string): ShellCommandResult  {
    const helpText = `usage: git stash list [<options>]
   or: git stash show [<stash>]
   or: git stash drop [<stash>]
   or: git stash ( pop | apply ) [<stash>]
   or: git stash push [-m <message>] [-u | --include-untracked]
   or: git stash clear
`;

    return createSuccessResult(helpText);
  }
}
