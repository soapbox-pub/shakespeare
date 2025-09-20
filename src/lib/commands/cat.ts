import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'cat' command
 * Concatenate and display file contents
 */
export class CatCommand implements ShellCommand {
  name = 'cat';
  description = 'Concatenate and display file contents';
  usage = 'cat [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    // If input is provided (from pipe), return it
    if (input !== undefined) {
      return createSuccessResult(input);
    }

    // If no arguments provided, show usage
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing file operand\nUsage: ${this.usage}`);
    }

    try {
      const outputs: string[] = [];

      for (const filePath of args) {
        try {
          // Handle both absolute and relative paths
          let absolutePath: string;

          if (filePath.startsWith('/') || filePath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(filePath)) {
            // It's an absolute path - use it directly
            absolutePath = filePath;
          } else {
            // It's a relative path - resolve it relative to the current working directory
            absolutePath = join(cwd, filePath);
          }

          // Check if path exists and is a file
          const stats = await this.fs.stat(absolutePath);

          if (stats.isDirectory()) {
            return createErrorResult(`${this.name}: ${filePath}: Is a directory`);
          }

          // Read file content
          const content = await this.fs.readFile(absolutePath, 'utf8');
          outputs.push(content);

        } catch (error) {
          // Handle file not found or permission errors
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: ${filePath}: No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: ${filePath}: Permission denied`);
            } else {
              return createErrorResult(`${this.name}: ${filePath}: ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: ${filePath}: Unknown error`);
          }
        }
      }

      // Join all file contents
      const result = outputs.join('');
      return createSuccessResult(result);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}