import { join } from "@std/path";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";

export class GitAddCommand implements GitSubcommand {
  name = 'add';
  description = 'Add file contents to the index';
  usage = 'git add [--all | -A] [--] [<pathspec>...]';

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

      const { options, paths } = this.parseArgs(args);

      if (options.all) {
        // Add all files (git add -A)
        return await this.addAllFiles();
      } else if (paths.length === 0) {
        return createErrorResult('Nothing specified, nothing added.\nMaybe you wanted to say \'git add .\'?');
      } else {
        // Add specific files
        return await this.addSpecificFiles(paths);
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

  private async addAllFiles(): Promise<ShellCommandResult> {
    try {
      // Get status to find all changed files
      const statusMatrix = await this.git.statusMatrix({
        dir: this.pwd,
      });

      let addedCount = 0;
      let removedCount = 0;

      for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
        try {
          if (workdirStatus === 0 && headStatus === 1) {
            // File was deleted
            await this.git.remove({
              
              dir: this.pwd,
              filepath,
            });
            removedCount++;
          } else if (workdirStatus === 1) {
            // File exists (new or modified)
            await this.git.add({
              
              dir: this.pwd,
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

  private async addSpecificFiles(paths: string[]): Promise<ShellCommandResult> {
    const addedFiles: string[] = [];
    const errors: string[] = [];

    for (const path of paths) {
      try {
        if (path === '.') {
          // Add current directory (all files in it)
          const statusMatrix = await this.git.statusMatrix({
            
            dir: this.pwd,
          });

          for (const [filepath, headStatus, workdirStatus] of statusMatrix) {
            try {
              if (workdirStatus === 0 && headStatus === 1) {
                // File was deleted
                await this.git.remove({
                  
                  dir: this.pwd,
                  filepath,
                });
                addedFiles.push(filepath);
              } else if (workdirStatus === 1) {
                // File exists
                await this.git.add({
                  
                  dir: this.pwd,
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

          const absolutePath = join(this.pwd, path);

          // Check if file/directory exists
          try {
            const stats = await this.fs.stat(absolutePath);

            if (stats.isDirectory()) {
              // Add all files in directory
              await this.addDirectory(path, addedFiles);
            } else {
              // Add single file
              await this.git.add({
                
                dir: this.pwd,
                filepath: path,
              });
              addedFiles.push(path);
            }
          } catch {
            // Check if it's a deleted file
            try {
              await this.git.remove({
                
                dir: this.pwd,
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

  private async addDirectory(dirPath: string, addedFiles: string[]): Promise<void> {
    const absolutePath = join(this.pwd, dirPath);
    const entries = await this.fs.readdir(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue; // Skip hidden files
      }

      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.addDirectory(entryPath, addedFiles);
      } else {
        try {
          await this.git.add({
            
            dir: this.pwd,
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