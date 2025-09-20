import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'diff' command
 * Compare files line by line
 */
export class DiffCommand implements ShellCommand {
  name = 'diff';
  description = 'Compare files line by line';
  usage = 'diff [-u] file1 file2';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    try {
      const { options, files } = this.parseArgs(args);

      if (files.length !== 2) {
        return createErrorResult(`${this.name}: missing operand (need exactly 2 files)`);
      }

      const [file1, file2] = files;

      // Read both files
      let content1: string, content2: string;

      try {
        // Handle absolute paths
        if (file1.startsWith('/') || file1.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(file1)) {
          return createErrorResult(`${this.name}: absolute paths are not supported: ${file1}`);
        }
        if (file2.startsWith('/') || file2.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(file2)) {
          return createErrorResult(`${this.name}: absolute paths are not supported: ${file2}`);
        }

        const absolutePath1 = join(cwd, file1);
        const absolutePath2 = join(cwd, file2);

        const stats1 = await this.fs.stat(absolutePath1);
        const stats2 = await this.fs.stat(absolutePath2);

        if (stats1.isDirectory()) {
          return createErrorResult(`${this.name}: ${file1}: Is a directory`);
        }
        if (stats2.isDirectory()) {
          return createErrorResult(`${this.name}: ${file2}: Is a directory`);
        }

        content1 = await this.fs.readFile(absolutePath1, 'utf8');
        content2 = await this.fs.readFile(absolutePath2, 'utf8');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('ENOENT') || error.message.includes('not found')) {
            return createErrorResult(`${this.name}: No such file or directory`);
          } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
            return createErrorResult(`${this.name}: Permission denied`);
          } else {
            return createErrorResult(`${this.name}: ${error.message}`);
          }
        } else {
          return createErrorResult(`${this.name}: Unknown error`);
        }
      }

      // Compare files
      if (content1 === content2) {
        return createSuccessResult('');
      }

      // Generate diff output
      const lines1 = content1.split('\n');
      const lines2 = content2.split('\n');

      if (options.unified) {
        const diff = this.generateUnifiedDiff(lines1, lines2, file1, file2);
        return createErrorResult(diff, 1);
      } else {
        const diff = this.generateNormalDiff(lines1, lines2);
        return createErrorResult(diff, 1);
      }

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateNormalDiff(lines1: string[], lines2: string[]): string {
    const result: string[] = [];

    // Find the first difference
    let commonPrefix = 0;
    const minLen = Math.min(lines1.length, lines2.length);

    while (commonPrefix < minLen && lines1[commonPrefix] === lines2[commonPrefix]) {
      commonPrefix++;
    }

    if (lines1.length === lines2.length && commonPrefix === lines1.length) {
      // Files are identical
      return '';
    }

    if (lines1.length < lines2.length) {
      // Lines added after commonPrefix
      const startLine = commonPrefix + 1;
      const endLine = lines2.length;
      result.push(`${commonPrefix}a${startLine},${endLine}`);
      for (let i = commonPrefix; i < lines2.length; i++) {
        result.push(`> ${lines2[i]}`);
      }
    } else if (lines1.length > lines2.length) {
      // Lines deleted after commonPrefix
      const startLine = commonPrefix + 1;
      const endLine = lines1.length;
      result.push(`${startLine},${endLine}d${commonPrefix}`);
      for (let i = commonPrefix; i < lines1.length; i++) {
        result.push(`< ${lines1[i]}`);
      }
    } else {
      // Same length but different content
      for (let i = commonPrefix; i < minLen; i++) {
        if (lines1[i] !== lines2[i]) {
          result.push(`${i + 1}c${i + 1}`);
          result.push(`< ${lines1[i]}`);
          result.push('---');
          result.push(`> ${lines2[i]}`);
        }
      }
    }

    return result.join('\n') + (result.length > 0 ? '\n' : '');
  }

  private generateUnifiedDiff(lines1: string[], lines2: string[], file1: string, file2: string): string {
    const result: string[] = [];
    result.push(`--- ${file1}`);
    result.push(`+++ ${file2}`);

    const maxLen = Math.max(lines1.length, lines2.length);
    let hasChanges = false;

    for (let i = 0; i < maxLen; i++) {
      const line1 = i < lines1.length ? lines1[i] : undefined;
      const line2 = i < lines2.length ? lines2[i] : undefined;

      if (line1 !== line2) {
        if (!hasChanges) {
          // Start of a change block
          const start1 = Math.max(0, i - 3);
          const start2 = Math.max(0, i - 3);
          result.push(`@@ -${start1 + 1},${lines1.length} +${start2 + 1},${lines2.length} @@`);

          // Add context lines before the change
          for (let j = Math.max(0, i - 3); j < i; j++) {
            if (j < lines1.length) {
              result.push(` ${lines1[j]}`);
            }
          }
          hasChanges = true;
        }

        if (line1 !== undefined) {
          result.push(`-${line1}`);
        }
        if (line2 !== undefined) {
          result.push(`+${line2}`);
        }
      } else if (hasChanges && line1 !== undefined) {
        // Context line after a change
        result.push(` ${line1}`);
      }
    }

    return result.join('\n') + (result.length > 2 ? '\n' : '');
  }

  private parseArgs(args: string[]): {
    options: { unified: boolean };
    files: string[]
  } {
    const options = { unified: false };
    const files: string[] = [];

    for (const arg of args) {
      if (arg === '-u') {
        options.unified = true;
      } else if (arg.startsWith('-') && arg.includes('u')) {
        options.unified = true;
      } else if (!arg.startsWith('-')) {
        files.push(arg);
      }
    }

    return { options, files };
  }
}