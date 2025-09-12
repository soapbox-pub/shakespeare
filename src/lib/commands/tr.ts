import { join } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'tr' command
 * Translate or delete characters
 */
export class TrCommand implements ShellCommand {
  name = 'tr';
  description = 'Translate or delete characters';
  usage = 'tr [-d] SET1 [SET2] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    try {
      const { options, sets, files } = this.parseArgs(args);

      if (sets.length === 0) {
        return createErrorResult(`${this.name}: missing operand`);
      }

      if (!options.delete && sets.length < 2) {
        return createErrorResult(`${this.name}: missing operand after '${sets[0]}'`);
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

      // Process content
      let result: string;
      if (options.delete) {
        result = this.deleteCharacters(content, sets[0]);
      } else {
        result = this.translateCharacters(content, sets[0], sets[1]);
      }

      return createSuccessResult(result);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private deleteCharacters(content: string, set1: string): string {
    const deleteChars = this.expandSet(set1);
    const deleteSet = new Set(deleteChars);

    return [...content].filter(char => !deleteSet.has(char)).join('');
  }

  private translateCharacters(content: string, set1: string, set2: string): string {
    const fromChars = this.expandSet(set1);
    const toChars = this.expandSet(set2);

    // Create translation map
    const translationMap = new Map<string, string>();
    for (let i = 0; i < fromChars.length; i++) {
      const toChar = i < toChars.length ? toChars[i] : toChars[toChars.length - 1];
      translationMap.set(fromChars[i], toChar);
    }

    return [...content].map(char => translationMap.get(char) || char).join('');
  }

  private expandSet(set: string): string[] {
    const result: string[] = [];
    let i = 0;

    while (i < set.length) {
      if (i + 2 < set.length && set[i + 1] === '-') {
        // Range like 'a-z'
        const start = set.charCodeAt(i);
        const end = set.charCodeAt(i + 2);

        if (start <= end) {
          for (let code = start; code <= end; code++) {
            result.push(String.fromCharCode(code));
          }
        } else {
          // Invalid range, treat as literal characters
          result.push(set[i], set[i + 1], set[i + 2]);
        }
        i += 3;
      } else {
        // Single character
        result.push(set[i]);
        i++;
      }
    }

    return result;
  }

  private parseArgs(args: string[]): {
    options: { delete: boolean };
    sets: string[];
    files: string[]
  } {
    const options = { delete: false };
    const sets: string[] = [];
    const files: string[] = [];
    let expectingSet = true;

    for (const arg of args) {
      if (arg === '-d') {
        options.delete = true;
      } else if (arg.startsWith('-') && arg !== '-') {
        // Parse combined options
        for (let i = 1; i < arg.length; i++) {
          if (arg[i] === 'd') {
            options.delete = true;
          }
        }
      } else if (expectingSet) {
        sets.push(arg);
        // If delete mode, only expect one set, otherwise expect two
        if (options.delete || sets.length === 2) {
          expectingSet = false;
        }
      } else {
        files.push(arg);
      }
    }

    return { options, sets, files };
  }
}