import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'cut' command
 * Extract sections from lines
 */
export class CutCommand implements ShellCommand {
  name = 'cut';
  description = 'Extract sections from lines';
  usage = 'cut -c LIST | -f LIST [-d DELIM] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    try {
      const { options, files } = this.parseArgs(args);

      if (!options.characters && !options.fields) {
        return createErrorResult(`${this.name}: you must specify a list of bytes, characters, or fields`);
      }

      let lines: string[] = [];

      // If input is provided (from pipe), process that input
      if (input !== undefined) {
        lines = input.split('\n');
        // Remove the last empty line if the input ends with a newline
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }
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
              return createErrorResult(`${this.name}: ${file}: Is a directory`);
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
      }

      // Process lines
      const result = lines.map(line => this.extractFromLine(line, options));
      const output = result.length > 0 ? result.join('\n') + '\n' : '';

      return createSuccessResult(output);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractFromLine(line: string, options: {
    characters?: number[];
    fields?: number[];
    delimiter: string;
  }): string {
    if (options.characters) {
      // Extract characters
      const chars = [...line];
      const extracted = options.characters
        .filter(pos => pos > 0 && pos <= chars.length)
        .map(pos => chars[pos - 1]);
      return extracted.join('');
    } else if (options.fields) {
      // Extract fields
      const fields = line.split(options.delimiter);
      const extracted = options.fields
        .filter(pos => pos > 0 && pos <= fields.length)
        .map(pos => fields[pos - 1]);
      return extracted.join(options.delimiter);
    }

    return line;
  }

  private parseList(listStr: string): number[] {
    const positions: number[] = [];
    const parts = listStr.split(',');

    for (const part of parts) {
      if (part.includes('-')) {
        // Range like "1-3"
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            positions.push(i);
          }
        }
      } else {
        // Single number
        const num = Number(part);
        if (!isNaN(num)) {
          positions.push(num);
        }
      }
    }

    return [...new Set(positions)].sort((a, b) => a - b);
  }

  private parseArgs(args: string[]): {
    options: {
      characters?: number[];
      fields?: number[];
      delimiter: string;
    };
    files: string[]
  } {
    const options: { characters?: number[]; fields?: number[]; delimiter: string } = {
      delimiter: '\t'
    };
    const files: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-c' && i + 1 < args.length) {
        options.characters = this.parseList(args[++i]);
      } else if (arg === '-f' && i + 1 < args.length) {
        options.fields = this.parseList(args[++i]);
      } else if (arg === '-d' && i + 1 < args.length) {
        options.delimiter = args[++i];
      } else if (arg.startsWith('-c')) {
        options.characters = this.parseList(arg.slice(2));
      } else if (arg.startsWith('-f')) {
        options.fields = this.parseList(arg.slice(2));
      } else if (arg.startsWith('-d')) {
        options.delimiter = arg.slice(2);
      } else if (!arg.startsWith('-')) {
        files.push(arg);
      }
    }

    return { options, files };
  }
}