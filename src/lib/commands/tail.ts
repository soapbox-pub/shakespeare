import { join } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'tail' command
 * Display the last lines of files
 */
export class TailCommand implements ShellCommand {
  name = 'tail';
  description = 'Display the last lines of files';
  usage = 'tail [-n lines] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    const { options, files } = this.parseArgs(args);

    // If input is provided (from pipe), process that input
    if (input !== undefined) {
      const lines = input.split('\n');
      const selectedLines = lines.slice(-options.lines);
      const result = selectedLines.join('\n');
      return createSuccessResult(result + (result && !result.endsWith('\n') ? '\n' : ''));
    }

    const targetFiles = files.length > 0 ? files : ['-']; // stdin if no files

    try {
      const outputs: string[] = [];

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
          const lines = content.split('\n');

          // Remove the last empty line if the file ends with a newline
          if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
          }

          // Take last n lines
          const selectedLines = lines.slice(-options.lines);

          // If we're showing multiple files, add a header
          if (targetFiles.length > 1) {
            outputs.push(`==> ${filePath} <==`);
          }

          // Join lines and add final newline
          const result = selectedLines.join('\n');
          outputs.push(result);

          // Add separator between files (except for last file)
          if (targetFiles.length > 1 && filePath !== targetFiles[targetFiles.length - 1]) {
            outputs.push('');
          }

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

      return createSuccessResult(outputs.join('\n') + (outputs.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { options: { lines: number }; files: string[] } {
    const options = { lines: 10 }; // Default to 10 lines
    const files: string[] = [];
    let i = 0;

    while (i < args.length) {
      const arg = args[i];

      if (arg === '-n') {
        // Next argument should be the number of lines
        i++;
        if (i < args.length) {
          const lineCount = parseInt(args[i], 10);
          if (!isNaN(lineCount) && lineCount > 0) {
            options.lines = lineCount;
          }
        }
      } else if (arg.startsWith('-n')) {
        // -n10 format
        const lineCount = parseInt(arg.slice(2), 10);
        if (!isNaN(lineCount) && lineCount > 0) {
          options.lines = lineCount;
        }
      } else if (arg.startsWith('-') && arg !== '-') {
        // Other options (ignore for now)
      } else {
        files.push(arg);
      }

      i++;
    }

    return { options, files };
  }
}