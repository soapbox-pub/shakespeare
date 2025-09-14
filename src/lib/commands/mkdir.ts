import { join, dirname } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";
import { isAbsolutePath, validateWritePath } from "../security";

/**
 * Implementation of the 'mkdir' command
 * Create directories
 */
export class MkdirCommand implements ShellCommand {
  name = 'mkdir';
  description = 'Create directories';
  usage = 'mkdir [-p] directory...';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing operand\nUsage: ${this.usage}`);
    }

    const { options, directories } = this.parseArgs(args);

    if (directories.length === 0) {
      return createErrorResult(`${this.name}: missing operand\nUsage: ${this.usage}`);
    }

    try {
      for (const dirPath of directories) {
        try {
          // Validate write permissions for absolute paths
          try {
            validateWritePath(dirPath, this.name);
          } catch (error) {
            return createErrorResult(error instanceof Error ? error.message : 'Unknown error');
          }

          // Handle both absolute and relative paths
          let absolutePath: string;
          if (isAbsolutePath(dirPath)) {
            absolutePath = dirPath;
          } else {
            absolutePath = join(cwd, dirPath);
          }

          if (options.parents) {
            // Create parent directories as needed (-p option)
            await this.createDirectoryRecursive(absolutePath, dirPath);
          } else {
            // Create only the specified directory
            try {
              // Check if it already exists
              const stats = await this.fs.stat(absolutePath);
              if (stats.isDirectory()) {
                return createErrorResult(`${this.name}: cannot create directory '${dirPath}': File exists`);
              } else {
                return createErrorResult(`${this.name}: cannot create directory '${dirPath}': File exists`);
              }
            } catch (error) {
              // Directory doesn't exist, try to create it
              if (error instanceof Error &&
                  (error.message.includes('ENOENT') || error.message.includes('not found'))) {

                // Check if parent directory exists
                const parentDir = dirname(absolutePath);
                try {
                  const parentStats = await this.fs.stat(parentDir);
                  if (!parentStats.isDirectory()) {
                    return createErrorResult(`${this.name}: cannot create directory '${dirPath}': Not a directory`);
                  }
                } catch {
                  return createErrorResult(`${this.name}: cannot create directory '${dirPath}': No such file or directory`);
                }

                // Create the directory
                await this.fs.mkdir(absolutePath);
              } else {
                return createErrorResult(`${this.name}: ${dirPath}: ${error.message}`);
              }
            }
          }

        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: ${dirPath}: Permission denied`);
            } else if (error.message.includes('EEXIST') || error.message.includes('exists')) {
              if (!options.parents) {
                return createErrorResult(`${this.name}: cannot create directory '${dirPath}': File exists`);
              }
              // With -p, ignore if directory already exists
            } else {
              return createErrorResult(`${this.name}: ${dirPath}: ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: ${dirPath}: Unknown error`);
          }
        }
      }

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createDirectoryRecursive(absolutePath: string, originalPath: string): Promise<void> {
    try {
      // Check if directory already exists
      const stats = await this.fs.stat(absolutePath);
      if (stats.isDirectory()) {
        return; // Already exists, nothing to do
      } else {
        throw new Error(`${this.name}: cannot create directory '${originalPath}': File exists`);
      }
    } catch (error) {
      // Directory doesn't exist, try to create it
      if (error instanceof Error &&
          (error.message.includes('ENOENT') || error.message.includes('not found'))) {

        // Try to create parent directory first
        const parentDir = dirname(absolutePath);
        if (parentDir !== absolutePath) { // Avoid infinite recursion
          await this.createDirectoryRecursive(parentDir, dirname(originalPath));
        }

        // Now create this directory
        await this.fs.mkdir(absolutePath);
      } else {
        throw error;
      }
    }
  }

  private parseArgs(args: string[]): {
    options: { parents: boolean };
    directories: string[];
  } {
    const options = { parents: false };
    const directories: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-') && arg !== '-') {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'p':
              options.parents = true;
              break;
            default:
              // Ignore unknown options
              break;
          }
        }
      } else {
        directories.push(arg);
      }
    }

    return { options, directories };
  }
}