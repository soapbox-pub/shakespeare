import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'sed' command
 * Stream editor for filtering and transforming text
 */
export class SedCommand implements ShellCommand {
  name = 'sed';
  description = 'Stream editor for filtering and transforming text';
  usage = 'sed [-i] [-n] [-e script] [script] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing script\nUsage: ${this.usage}`);
    }

    try {
      const { options, scripts, files } = this.parseArgs(args);

      if (scripts.length === 0) {
        return createErrorResult(`${this.name}: missing script\nUsage: ${this.usage}`);
      }

      let content = '';

      // If input is provided (from pipe), use that input
      if (input !== undefined) {
        content = input;
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

            const fileContent = await this.fs.readFile(absolutePath, 'utf8');
            content += fileContent;
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

      // Process content with sed scripts
      let result = content;
      for (const script of scripts) {
        result = await this.processScript(script, result, options);
      }

      // Handle in-place editing
      if (options.inPlace && files.length > 0) {
        for (const file of files) {
          const absolutePath = join(cwd, file);
          await this.fs.writeFile(absolutePath, result, 'utf8');
        }
        return createSuccessResult('');
      }

      // Handle quiet mode
      if (options.quiet) {
        // In quiet mode, only explicitly printed lines are output
        // For now, we'll return empty unless there are 'p' commands
        return createSuccessResult('');
      }

      return createSuccessResult(result);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processScript(script: string, content: string, options: { quiet: boolean; inPlace: boolean }): Promise<string> {
    // Track if original content ended with newline
    const originalEndsWithNewline = content.endsWith('\n');

    // Split lines but handle the trailing newline properly
    let lines = content.split('\n');
    if (originalEndsWithNewline && lines[lines.length - 1] === '') {
      lines = lines.slice(0, -1); // Remove the empty line at the end
    }

    const resultLines: string[] = [];

    // Parse the sed script
    const command = this.parseScript(script);

    if (!command) {
      throw new Error(`Invalid sed script: ${script}`);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let processedLine = line;
      let shouldPrint = !options.quiet;

      switch (command.type) {
        case 's': {// Substitute
          const substituted = this.substitute(line, command.pattern!, command.replacement!, command.flags!);
          processedLine = substituted;
          break;
        }

        case 'd': // Delete
          if (this.matchesAddress(i + 1, line, command.address ?? null)) {
            shouldPrint = false;
            continue;
          }
          break;

        case 'p': // Print
          if (this.matchesAddress(i + 1, line, command.address ?? null)) {
            resultLines.push(processedLine);
            if (options.quiet) {
              shouldPrint = false;
            }
          }
          break;

        case 'q': // Quit
          if (this.matchesAddress(i + 1, line, command.address ?? null)) {
            resultLines.push(processedLine);
            return this.formatOutput(resultLines, originalEndsWithNewline);
          }
          break;

        case 'a': // Append
          if (this.matchesAddress(i + 1, line, command.address ?? null)) {
            resultLines.push(processedLine);
            resultLines.push(command.text || '');
            shouldPrint = false;
          }
          break;

        case 'i': // Insert
          if (this.matchesAddress(i + 1, line, command.address ?? null)) {
            resultLines.push(command.text || '');
            resultLines.push(processedLine);
            shouldPrint = false;
          }
          break;

        case 'c': // Change
          if (this.matchesAddress(i + 1, line, command.address ?? null)) {
            resultLines.push(command.text || '');
            shouldPrint = false;
          }
          break;
      }

      if (shouldPrint) {
        resultLines.push(processedLine);
      }
    }

    return this.formatOutput(resultLines, originalEndsWithNewline);
  }

  private formatOutput(lines: string[], originalEndsWithNewline: boolean): string {
    if (lines.length === 0) {
      return originalEndsWithNewline ? '\n' : '';
    }

    const result = lines.join('\n');

    // Only add trailing newline if original content had one
    return originalEndsWithNewline ? result + '\n' : result;
  }

  private parseScript(script: string): SedCommandSpec | null {
    // Handle substitute command: s/pattern/replacement/flags
    const substituteMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?s\/(.*)\/(.*)\/([gimx]*)$/);
    if (substituteMatch) {
      return {
        type: 's',
        address: substituteMatch[1] || null,
        pattern: substituteMatch[2],
        replacement: substituteMatch[3],
        flags: substituteMatch[4]
      };
    }

    // Handle delete command: d or address d
    const deleteMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?d$/);
    if (deleteMatch) {
      return {
        type: 'd',
        address: deleteMatch[1] || null
      };
    }

    // Handle print command: p or address p
    const printMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?p$/);
    if (printMatch) {
      return {
        type: 'p',
        address: printMatch[1] || null
      };
    }

    // Handle quit command: q or address q
    const quitMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?q$/);
    if (quitMatch) {
      return {
        type: 'q',
        address: quitMatch[1] || null
      };
    }

    // Handle append command: a\text or address a\text
    const appendMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?a\\(.*)$/);
    if (appendMatch) {
      return {
        type: 'a',
        address: appendMatch[1] || null,
        text: appendMatch[2]
      };
    }

    // Handle insert command: i\text or address i\text
    const insertMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?i\\(.*)$/);
    if (insertMatch) {
      return {
        type: 'i',
        address: insertMatch[1] || null,
        text: insertMatch[2]
      };
    }

    // Handle change command: c\text or address c\text
    const changeMatch = script.match(/^(?:(\d+|\$|\/.*?\/)?)?c\\(.*)$/);
    if (changeMatch) {
      return {
        type: 'c',
        address: changeMatch[1] || null,
        text: changeMatch[2]
      };
    }

    return null;
  }

  private substitute(line: string, pattern: string, replacement: string, flags: string): string {
    try {
      const regexFlags = flags.includes('g') ? 'g' : '';
      const caseInsensitive = flags.includes('i');

      const regex = new RegExp(pattern, regexFlags + (caseInsensitive ? 'i' : ''));
      return line.replace(regex, replacement);
    } catch {
      // If regex is invalid, return original line
      return line;
    }
  }

  private matchesAddress(lineNumber: number, line: string, address: string | null): boolean {
    if (!address) {
      return true; // No address means match all lines
    }

    // Line number address
    if (/^\d+$/.test(address)) {
      return lineNumber === parseInt(address);
    }

    // Last line address
    if (address === '$') {
      // This is tricky to implement without knowing total lines
      // For now, we'll assume it doesn't match
      return false;
    }

    // Pattern address /pattern/
    const patternMatch = address.match(/^\/(.*)\/$/);
    if (patternMatch) {
      try {
        const regex = new RegExp(patternMatch[1]);
        return regex.test(line);
      } catch {
        return false;
      }
    }

    return false;
  }

  private parseArgs(args: string[]): {
    options: { quiet: boolean; inPlace: boolean };
    scripts: string[];
    files: string[]
  } {
    const options = { quiet: false, inPlace: false };
    const scripts: string[] = [];
    const files: string[] = [];
    let i = 0;
    let expectingScript = false;

    while (i < args.length) {
      const arg = args[i];

      if (arg === '-n') {
        options.quiet = true;
      } else if (arg === '-i') {
        options.inPlace = true;
      } else if (arg === '-e') {
        expectingScript = true;
      } else if (arg.startsWith('-') && arg !== '-') {
        // Parse combined options
        for (let j = 1; j < arg.length; j++) {
          const char = arg[j];
          switch (char) {
            case 'n':
              options.quiet = true;
              break;
            case 'i':
              options.inPlace = true;
              break;
            case 'e':
              expectingScript = true;
              break;
          }
        }
      } else if (expectingScript || (scripts.length === 0 && !arg.startsWith('-'))) {
        scripts.push(arg);
        expectingScript = false;
      } else {
        files.push(arg);
      }

      i++;
    }

    return { options, scripts, files };
  }
}

interface SedCommandSpec {
  type: 's' | 'd' | 'p' | 'q' | 'a' | 'i' | 'c';
  address?: string | null;
  pattern?: string;
  replacement?: string;
  flags?: string;
  text?: string;
}