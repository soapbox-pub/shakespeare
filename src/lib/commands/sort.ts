import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'sort' command
 * Sort lines of text
 */
export class SortCommand implements ShellCommand {
  name = 'sort';
  description = 'Sort lines of text';
  usage = 'sort [-r] [-n] [-u] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    try {
      const { options, files } = this.parseArgs(args);
      let lines: string[] = [];

      // If input is provided (from pipe), sort that input
      if (input !== undefined) {
        lines = input.split('\n');
      } else if (files.length === 0) {
        // Read from stdin (not implemented in this context, return empty)
        return createSuccessResult('');
      } else {
        // Read all files
        for (const file of files) {
        try {
          // Handle absolute paths
          if (file.startsWith('/') || file.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(file)) {
            return createErrorResult(`${this.name}: absolute paths are not supported: ${file}`);
          }

          const absolutePath = join(cwd, file);
          const stats = await this.fs.stat(absolutePath);

          if (stats.isDirectory()) {
            return createErrorResult(`${this.name}: read error: ${file}: Is a directory`);
          }

          const content = await this.fs.readFile(absolutePath, 'utf8');
          const fileLines = content.split('\n');

          // Remove the last empty line if the file ends with a newline
          if (fileLines.length > 0 && fileLines[fileLines.length - 1] === '') {
            fileLines.pop();
          }

          lines.push(...fileLines);
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: open failed: ${file}: No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: open failed: ${file}: Permission denied`);
            } else {
              return createErrorResult(`${this.name}: open failed: ${file}: ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: open failed: ${file}: Unknown error`);
          }
        }
        }
      }

      // Sort the lines
      if (options.numeric) {
        lines.sort((a, b) => {
          const numA = parseFloat(a) || 0;
          const numB = parseFloat(b) || 0;
          return options.reverse ? numB - numA : numA - numB;
        });
      } else {
        lines.sort((a, b) => {
          const result = a.localeCompare(b);
          return options.reverse ? -result : result;
        });
      }

      // Remove duplicates if requested
      if (options.unique) {
        lines = [...new Set(lines)];
      }

      const output = lines.length > 0 ? lines.join('\n') + '\n' : '';
      return createSuccessResult(output);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    options: { reverse: boolean; numeric: boolean; unique: boolean };
    files: string[]
  } {
    const options = { reverse: false, numeric: false, unique: false };
    const files: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'r':
              options.reverse = true;
              break;
            case 'n':
              options.numeric = true;
              break;
            case 'u':
              options.unique = true;
              break;
            default:
              // Ignore unknown options for now
              break;
          }
        }
      } else {
        files.push(arg);
      }
    }

    return { options, files };
  }
}