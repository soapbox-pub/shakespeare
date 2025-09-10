import { join } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'wc' command
 * Count lines, words, and characters in files
 */
export class WcCommand implements ShellCommand {
  name = 'wc';
  description = 'Count lines, words, and characters in files';
  usage = 'wc [-l] [-w] [-c] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    const { options, files } = this.parseArgs(args);
    const targetFiles = files.length > 0 ? files : ['-']; // stdin if no files

    // If no specific options, show all counts
    if (!options.lines && !options.words && !options.chars) {
      options.lines = true;
      options.words = true;
      options.chars = true;
    }

    try {
      const results: Array<{ lines: number; words: number; chars: number; name: string }> = [];
      let totalLines = 0;
      let totalWords = 0;
      let totalChars = 0;

      for (const filePath of targetFiles) {
        try {
          if (filePath === '-') {
            return createErrorResult(`${this.name}: reading from stdin is not supported`);
          }

          // Handle absolute paths
          if (filePath.startsWith('/') || filePath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(filePath)) {
            return createErrorResult(`${this.name}: absolute paths are not supported: ${filePath}`);
          }

          const absolutePath = join(cwd, filePath);

          // Check if path exists and is a file
          const stats = await this.fs.stat(absolutePath);

          if (stats.isDirectory()) {
            return createErrorResult(`${this.name}: ${filePath}: Is a directory`);
          }

          // Read file content
          const content = await this.fs.readFile(absolutePath, 'utf8');

          // Count lines, words, and characters
          const lines = content === '' ? 0 : content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
          const words = content.trim() ? content.trim().split(/\s+/).length : 0;
          const chars = content.length;

          results.push({ lines, words, chars, name: filePath });
          totalLines += lines;
          totalWords += words;
          totalChars += chars;

        } catch (error) {
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

      // Format output
      const outputs: string[] = [];

      for (const result of results) {
        const parts: string[] = [];

        if (options.lines) {
          parts.push(result.lines.toString().padStart(8));
        }
        if (options.words) {
          parts.push(result.words.toString().padStart(8));
        }
        if (options.chars) {
          parts.push(result.chars.toString().padStart(8));
        }

        parts.push(result.name);
        outputs.push(parts.join(' '));
      }

      // Add total line if multiple files
      if (results.length > 1) {
        const parts: string[] = [];

        if (options.lines) {
          parts.push(totalLines.toString().padStart(8));
        }
        if (options.words) {
          parts.push(totalWords.toString().padStart(8));
        }
        if (options.chars) {
          parts.push(totalChars.toString().padStart(8));
        }

        parts.push('total');
        outputs.push(parts.join(' '));
      }

      return createSuccessResult(outputs.join('\n') + (outputs.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    options: { lines: boolean; words: boolean; chars: boolean };
    files: string[];
  } {
    const options = { lines: false, words: false, chars: false };
    const files: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-') && arg !== '-') {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'l':
              options.lines = true;
              break;
            case 'w':
              options.words = true;
              break;
            case 'c':
              options.chars = true;
              break;
            default:
              // Ignore unknown options
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