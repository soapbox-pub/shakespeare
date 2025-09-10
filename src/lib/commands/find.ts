import { join, basename } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'find' command
 * Search for files and directories
 */
export class FindCommand implements ShellCommand {
  name = 'find';
  description = 'Search for files and directories';
  usage = 'find [path...] [-name pattern] [-type f|d]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    const { paths, options } = this.parseArgs(args);
    const searchPaths = paths.length > 0 ? paths : ['.']; // Default to current directory

    try {
      const results: string[] = [];

      for (const searchPath of searchPaths) {
        try {
          // Handle absolute paths
          if (searchPath.startsWith('/') || searchPath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(searchPath)) {
            return createErrorResult(`${this.name}: absolute paths are not supported: ${searchPath}`);
          }

          const absolutePath = join(cwd, searchPath);

          // Check if path exists
          const stats = await this.fs.stat(absolutePath);

          if (stats.isFile()) {
            // If it's a file, check if it matches the criteria
            if (this.matchesFilter(basename(searchPath), 'f', options)) {
              results.push(searchPath === '.' ? searchPath : searchPath);
            }
          } else if (stats.isDirectory()) {
            // Search recursively in directory
            const matches = await this.searchDirectory(absolutePath, searchPath, options);
            results.push(...matches);
          }

        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: ${searchPath}: No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: ${searchPath}: Permission denied`);
            } else {
              return createErrorResult(`${this.name}: ${searchPath}: ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: ${searchPath}: Unknown error`);
          }
        }
      }

      return createSuccessResult(results.join('\n') + (results.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchDirectory(
    dirPath: string,
    relativePath: string,
    options: { namePattern?: string; type?: 'f' | 'd' }
  ): Promise<string[]> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });
      const results: string[] = [];

      // Add the directory itself if it matches
      if (this.matchesFilter(basename(relativePath), 'd', options)) {
        results.push(relativePath);
      }

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        let entryRelativePath: string;

        if (relativePath === '.') {
          entryRelativePath = `./${entry.name}`;
        } else if (relativePath.startsWith('./')) {
          entryRelativePath = `${relativePath}/${entry.name}`;
        } else {
          entryRelativePath = join(relativePath, entry.name);
        }

        if (entry.isFile()) {
          if (this.matchesFilter(entry.name, 'f', options)) {
            results.push(entryRelativePath);
          }
        } else if (entry.isDirectory()) {
          // Recursively search subdirectory
          const subResults = await this.searchDirectory(entryPath, entryRelativePath, options);
          results.push(...subResults);
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  private matchesFilter(
    name: string,
    type: 'f' | 'd',
    options: { namePattern?: string; type?: 'f' | 'd' }
  ): boolean {
    // Check type filter
    if (options.type && options.type !== type) {
      return false;
    }

    // Check name pattern (simple glob-style matching)
    if (options.namePattern) {
      const pattern = options.namePattern
        .replace(/\./g, '\\.')  // Escape dots
        .replace(/\*/g, '.*')   // Convert * to .*
        .replace(/\?/g, '.');   // Convert ? to .

      const regex = new RegExp(`^${pattern}$`, 'i');
      return regex.test(name);
    }

    return true;
  }

  private parseArgs(args: string[]): {
    paths: string[];
    options: { namePattern?: string; type?: 'f' | 'd' };
  } {
    const paths: string[] = [];
    const options: { namePattern?: string; type?: 'f' | 'd' } = {};
    let i = 0;

    while (i < args.length) {
      const arg = args[i];

      if (arg === '-name') {
        i++;
        if (i < args.length) {
          options.namePattern = args[i];
        }
      } else if (arg === '-type') {
        i++;
        if (i < args.length) {
          const typeArg = args[i];
          if (typeArg === 'f' || typeArg === 'd') {
            options.type = typeArg;
          }
        }
      } else if (!arg.startsWith('-')) {
        paths.push(arg);
      }
      // Ignore other options for now

      i++;
    }

    return { paths, options };
  }
}