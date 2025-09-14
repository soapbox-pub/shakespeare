import { join, dirname } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";
import { isAbsolutePath, validateWritePath } from "../security";

/**
 * Implementation of the 'touch' command
 * Create empty files or update timestamps
 */
export class TouchCommand implements ShellCommand {
  name = 'touch';
  description = 'Create empty files or update timestamps';
  usage = 'touch file...';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing file operand\nUsage: ${this.usage}`);
    }

    try {
      for (const filePath of args) {
        try {
          // Validate write permissions for absolute paths
          try {
            validateWritePath(filePath, this.name);
          } catch (error) {
            return createErrorResult(error instanceof Error ? error.message : 'Unknown error');
          }

          // Handle both absolute and relative paths
          let absolutePath: string;
          if (isAbsolutePath(filePath)) {
            absolutePath = filePath;
          } else {
            absolutePath = join(cwd, filePath);
          }

          try {
            // Check if file exists
            const stats = await this.fs.stat(absolutePath);

            if (stats.isDirectory()) {
              return createErrorResult(`${this.name}: ${filePath}: Is a directory`);
            }

            // File exists, update timestamp (in real systems)
            // For this implementation, we'll just leave it as is since
            // LightningFS doesn't have a direct way to update timestamps
            // without modifying the file content

          } catch (error) {
            // File doesn't exist, create it
            if (error instanceof Error &&
                (error.message.includes('ENOENT') || error.message.includes('not found'))) {

              // Ensure parent directory exists
              const parentDir = dirname(absolutePath);
              try {
                await this.fs.stat(parentDir);
              } catch {
                // Parent directory doesn't exist
                return createErrorResult(`${this.name}: cannot touch '${filePath}': No such file or directory`);
              }

              // Create empty file
              await this.fs.writeFile(absolutePath, '', 'utf8');
            } else {
              // Other error (permission, etc.)
              return createErrorResult(`${this.name}: ${filePath}: ${error.message}`);
            }
          }

        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: ${filePath}: Permission denied`);
            } else {
              return createErrorResult(`${this.name}: ${filePath}: ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: ${filePath}: Unknown error`);
          }
        }
      }

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}