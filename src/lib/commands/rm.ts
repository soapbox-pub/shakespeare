import { join } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'rm' command
 * Remove files and directories
 */
export class RmCommand implements ShellCommand {
  name = 'rm';
  description = 'Remove files and directories';
  usage = 'rm [-rf] file...';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing operand\nUsage: ${this.usage}`);
    }

    try {
      const { options, paths } = this.parseArgs(args);

      if (paths.length === 0) {
        return createErrorResult(`${this.name}: missing operand\nUsage: ${this.usage}`);
      }

      for (const path of paths) {
        try {
          // Handle absolute paths
          if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
            return createErrorResult(`${this.name}: absolute paths are not supported: ${path}`);
          }

          // Prevent removing current directory or parent directory
          if (path === '.' || path === '..') {
            return createErrorResult(`${this.name}: cannot remove '${path}': Invalid argument`);
          }

          const absolutePath = join(cwd, path);
          
          try {
            const stats = await this.fs.stat(absolutePath);

            if (stats.isDirectory()) {
              if (!options.recursive) {
                return createErrorResult(`${this.name}: cannot remove '${path}': Is a directory`);
              }
              
              // Recursive directory removal
              await this.removeDirectoryRecursive(absolutePath);
            } else {
              // Remove file
              await this.fs.unlink(absolutePath);
            }
          } catch (statError) {
            if (!options.force) {
              if (statError instanceof Error) {
                if (statError.message.includes('ENOENT') || statError.message.includes('not found')) {
                  return createErrorResult(`${this.name}: cannot remove '${path}': No such file or directory`);
                } else if (statError.message.includes('EACCES') || statError.message.includes('permission')) {
                  return createErrorResult(`${this.name}: cannot remove '${path}': Permission denied`);
                } else {
                  return createErrorResult(`${this.name}: cannot remove '${path}': ${statError.message}`);
                }
              } else {
                return createErrorResult(`${this.name}: cannot remove '${path}': Unknown error`);
              }
            }
            // With -f flag, ignore errors for non-existent files
          }
        } catch (error) {
          if (!options.force) {
            return createErrorResult(`${this.name}: cannot remove '${path}': ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          // With -f flag, continue with other files
        }
      }

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async removeDirectoryRecursive(dirPath: string): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      // Remove all contents first
      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.removeDirectoryRecursive(entryPath);
        } else {
          await this.fs.unlink(entryPath);
        }
      }

      // Remove the directory itself
      await this.fs.rmdir(dirPath);
    } catch (error) {
      throw new Error(`Failed to remove directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { options: { recursive: boolean; force: boolean }; paths: string[] } {
    const options = { recursive: false, force: false };
    const paths: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'r':
            case 'R':
              options.recursive = true;
              break;
            case 'f':
              options.force = true;
              break;
            default:
              // Ignore unknown options for now
              break;
          }
        }
      } else {
        paths.push(arg);
      }
    }

    return { options, paths };
  }
}