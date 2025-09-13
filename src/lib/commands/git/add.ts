import git from 'isomorphic-git';
import { join } from "@std/path";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitAddCommand implements GitSubcommand {
  name = 'add';
  description = 'Add file contents to the index';
  usage = 'git add [--all | -A] [--] [<pathspec>...]';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { options, paths } = this.parseArgs(args);

      if (options.all) {
        // Add all files (git add -A)
        return await this.addAllFiles(fs, cwd);
      } else if (paths.length === 0) {
        return createErrorResult('Nothing specified, nothing added.\nMaybe you wanted to say \'git add .\'?');
      } else {
        // Add specific files
        return await this.addSpecificFiles(fs, cwd, paths);
      }

    } catch (error) {
      return createErrorResult(`git add: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { options: { all: boolean }; paths: string[] } {
    const options = { all: false };
    const paths: string[] = [];
    let foundDoubleDash = false;

    for (const arg of args) {
      if (arg === '--') {
        foundDoubleDash = true;
        continue;
      }

      if (!foundDoubleDash && (arg === '--all' || arg === '-A')) {
        options.all = true;
      } else if (!foundDoubleDash && arg.startsWith('-')) {
        // Ignore other options for now
        continue;
      } else {
        paths.push(arg);
      }
    }

    return { options, paths };
  }

  private async addAllFiles(fs: JSRuntimeFS, cwd: string): Promise<ShellCommandResult> {
    try {
      // Get status to find all changed files
      const statusMatrix = await git.statusMatrix({
        fs,
        dir: cwd,
      });

      let addedCount = 0;
      let removedCount = 0;

      for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
        try {
          if (workdirStatus === 0 && headStatus === 1) {
            // File was deleted
            await git.remove({
              fs,
              dir: cwd,
              filepath,
            });
            removedCount++;
          } else if (workdirStatus === 1) {
            // File exists (new or modified)
            await git.add({
              fs,
              dir: cwd,
              filepath,
            });
            addedCount++;
          }
        } catch {
          // Continue with other files if one fails
          console.warn(`Failed to add/remove ${filepath}`);
        }
      }

      const messages: string[] = [];
      if (addedCount > 0) {
        messages.push(`Added ${addedCount} file${addedCount !== 1 ? 's' : ''}`);
      }
      if (removedCount > 0) {
        messages.push(`Removed ${removedCount} file${removedCount !== 1 ? 's' : ''}`);
      }

      if (messages.length === 0) {
        return createSuccessResult('');
      }

      return createSuccessResult(messages.join(', ') + '\n');

    } catch (error) {
      return createErrorResult(`Failed to add all files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async addSpecificFiles(fs: JSRuntimeFS, cwd: string, paths: string[]): Promise<ShellCommandResult> {
    const addedFiles: string[] = [];
    const errors: string[] = [];

    for (const path of paths) {
      try {
        if (path === '.') {
          // Add current directory (all files in it)
          const statusMatrix = await git.statusMatrix({
            fs,
            dir: cwd,
          });

          for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
            try {
              if (workdirStatus === 0 && headStatus === 1) {
                // File was deleted
                await git.remove({
                  fs,
                  dir: cwd,
                  filepath,
                });
                addedFiles.push(filepath);
              } else if (workdirStatus === 1) {
                // File exists
                await git.add({
                  fs,
                  dir: cwd,
                  filepath,
                });
                addedFiles.push(filepath);
              }
            } catch {
              // Continue with other files
            }
          }
        } else {
          // Handle absolute paths
          if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
            errors.push(`'${path}': absolute paths are not supported`);
            continue;
          }

          const absolutePath = join(cwd, path);

          // Check if file/directory exists
          try {
            const stats = await fs.stat(absolutePath);

            if (stats.isDirectory()) {
              // Add all files in directory
              await this.addDirectory(fs, cwd, path, addedFiles);
            } else {
              // Add single file
              await git.add({
                fs,
                dir: cwd,
                filepath: path,
              });
              addedFiles.push(path);
            }
          } catch {
            // Check if it's a deleted file
            try {
              await git.remove({
                fs,
                dir: cwd,
                filepath: path,
              });
              addedFiles.push(path);
            } catch {
              errors.push(`pathspec '${path}' did not match any files`);
            }
          }
        }
      } catch (error) {
        errors.push(`'${path}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      return createErrorResult(errors.join('\n'));
    }

    if (addedFiles.length === 0) {
      return createSuccessResult('');
    }

    return createSuccessResult(`Added ${addedFiles.length} file${addedFiles.length !== 1 ? 's' : ''}\n`);
  }

  private async addDirectory(fs: JSRuntimeFS, cwd: string, dirPath: string, addedFiles: string[]): Promise<void> {
    const absolutePath = join(cwd, dirPath);
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue; // Skip hidden files
      }

      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.addDirectory(fs, cwd, entryPath, addedFiles);
      } else {
        try {
          await git.add({
            fs,
            dir: cwd,
            filepath: entryPath,
          });
          addedFiles.push(entryPath);
        } catch {
          // Continue with other files
        }
      }
    }
  }
}