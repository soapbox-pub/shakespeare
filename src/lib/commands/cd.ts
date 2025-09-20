import { join, resolve, dirname } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";
import { isAbsolutePath } from "../security";

/**
 * Implementation of the 'cd' command
 * Change directory
 */
export class CdCommand implements ShellCommand {
  name = 'cd';
  description = 'Change directory';
  usage = 'cd [directory]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    try {
      let targetPath: string;

      if (args.length === 0) {
        // cd with no arguments - stay in current directory for simplicity
        return createSuccessResult('', cwd);
      } else if (args.length === 1) {
        targetPath = args[0];
      } else {
        return createErrorResult(`${this.name}: too many arguments`);
      }

      // Handle both absolute and relative paths
      let newCwd: string;

      if (isAbsolutePath(targetPath)) {
        // Absolute path - use it directly
        newCwd = targetPath;
      } else if (targetPath === '.') {
        // Current directory
        newCwd = cwd;
      } else if (targetPath === '..') {
        // Parent directory
        const parentPath = dirname(cwd);
        // Don't allow going above the filesystem root
        if (parentPath === cwd) {
          return createErrorResult(`${this.name}: cannot access parent directory: Permission denied`);
        }
        newCwd = parentPath;
      } else {
        // Relative path
        newCwd = join(cwd, targetPath);
      }

      // Normalize the path
      newCwd = resolve(newCwd);

      // Check if the target directory exists and is a directory
      try {
        const stats = await this.fs.stat(newCwd);

        if (!stats.isDirectory()) {
          return createErrorResult(`${this.name}: ${targetPath}: Not a directory`);
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('ENOENT') || error.message.includes('not found')) {
            return createErrorResult(`${this.name}: ${targetPath}: No such file or directory`);
          } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
            return createErrorResult(`${this.name}: ${targetPath}: Permission denied`);
          } else {
            return createErrorResult(`${this.name}: ${targetPath}: ${error.message}`);
          }
        } else {
          return createErrorResult(`${this.name}: ${targetPath}: Unknown error`);
        }
      }

      // Return success with the new working directory
      return createSuccessResult('', newCwd);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

