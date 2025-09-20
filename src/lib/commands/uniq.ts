import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'uniq' command
 * Report or omit repeated lines
 */
export class UniqCommand implements ShellCommand {
  name = 'uniq';
  description = 'Report or omit repeated lines';
  usage = 'uniq [-c] [-d] [-u] [file]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    try {
      const { options, file } = this.parseArgs(args);
      let lines: string[] = [];

      // If input is provided (from pipe), process that input
      if (input !== undefined) {
        lines = input.split('\n');
      } else if (!file) {
        // Read from stdin (not implemented in this context, return empty)
        return createSuccessResult('');
      } else {
        try {
        // Handle absolute paths
        if (file.startsWith('/') || file.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(file)) {
          return createErrorResult(`${this.name}: absolute paths are not supported: ${file}`);
        }

        const absolutePath = join(cwd, file);
        const stats = await this.fs.stat(absolutePath);

        if (stats.isDirectory()) {
          return createErrorResult(`${this.name}: ${file}: Is a directory`);
        }

        const content = await this.fs.readFile(absolutePath, 'utf8');
        lines = content.split('\n');

        // Remove the last empty line if the file ends with a newline
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('ENOENT') || error.message.includes('not found')) {
            return createErrorResult(`${this.name}: ${file}: No such file or directory`);
          } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
            return createErrorResult(`${this.name}: ${file}: Permission denied`);
          } else {
            return createErrorResult(`${this.name}: ${file}: ${error.message}`);
          }
        } else {
          return createErrorResult(`${this.name}: ${file}: Unknown error`);
        }
        }
      }

      // Process lines for uniqueness
      const result = this.processLines(lines, options);
      const output = result.length > 0 ? result.join('\n') + '\n' : '';

      return createSuccessResult(output);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private processLines(
    lines: string[],
    options: { count: boolean; duplicatesOnly: boolean; uniqueOnly: boolean }
  ): string[] {
    if (lines.length === 0) return [];

    const result: string[] = [];
    let currentLine = lines[0];
    let count = 1;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === currentLine) {
        count++;
      } else {
        // Process the current group
        this.addLineToResult(result, currentLine, count, options);

        // Start new group
        currentLine = lines[i];
        count = 1;
      }
    }

    // Process the last group
    this.addLineToResult(result, currentLine, count, options);

    return result;
  }

  private addLineToResult(
    result: string[],
    line: string,
    count: number,
    options: { count: boolean; duplicatesOnly: boolean; uniqueOnly: boolean }
  ): void {
    const isDuplicate = count > 1;
    const isUnique = count === 1;

    // Apply filters
    if (options.duplicatesOnly && !isDuplicate) return;
    if (options.uniqueOnly && !isUnique) return;

    // Format output
    if (options.count) {
      result.push(`${count.toString().padStart(7)} ${line}`);
    } else {
      result.push(line);
    }
  }

  private parseArgs(args: string[]): {
    options: { count: boolean; duplicatesOnly: boolean; uniqueOnly: boolean };
    file?: string
  } {
    const options = { count: false, duplicatesOnly: false, uniqueOnly: false };
    let file: string | undefined;

    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'c':
              options.count = true;
              break;
            case 'd':
              options.duplicatesOnly = true;
              break;
            case 'u':
              options.uniqueOnly = true;
              break;
            default:
              // Ignore unknown options for now
              break;
          }
        }
      } else {
        if (!file) {
          file = arg;
        }
        // uniq typically only accepts one file argument
      }
    }

    return { options, file };
  }
}