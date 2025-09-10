import { join } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'grep' command
 * Search for patterns in files
 */
export class GrepCommand implements ShellCommand {
  name = 'grep';
  description = 'Search for patterns in files';
  usage = 'grep [-i] [-n] [-r] pattern [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing pattern\nUsage: ${this.usage}`);
    }

    const { options, pattern, files } = this.parseArgs(args);
    
    if (!pattern) {
      return createErrorResult(`${this.name}: missing pattern\nUsage: ${this.usage}`);
    }

    const targetFiles = files.length > 0 ? files : ['-']; // stdin if no files

    try {
      const regex = new RegExp(pattern, options.ignoreCase ? 'gi' : 'g');
      const outputs: string[] = [];
      let foundMatches = false;

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
          
          // Check if path exists
          const stats = await this.fs.stat(absolutePath);
          
          if (stats.isDirectory()) {
            if (options.recursive) {
              // Recursively search directory
              const dirMatches = await this.searchDirectory(absolutePath, regex, options, cwd);
              if (dirMatches.length > 0) {
                outputs.push(...dirMatches);
                foundMatches = true;
              }
            } else {
              return createErrorResult(`${this.name}: ${filePath}: Is a directory`);
            }
          } else {
            // Search in file
            const fileMatches = await this.searchFile(absolutePath, regex, options, targetFiles.length > 1 ? filePath : null);
            if (fileMatches.length > 0) {
              outputs.push(...fileMatches);
              foundMatches = true;
            }
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

      if (!foundMatches) {
        // grep exits with code 1 when no matches found
        return {
          exitCode: 1,
          stdout: '',
          stderr: '',
        };
      }

      return createSuccessResult(outputs.join('\n') + (outputs.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchFile(
    filePath: string, 
    regex: RegExp, 
    options: { ignoreCase: boolean; showLineNumbers: boolean; recursive: boolean },
    displayName: string | null
  ): Promise<string[]> {
    try {
      const content = await this.fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const matches: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (regex.test(line)) {
          let output = '';
          
          if (displayName) {
            output += `${displayName}:`;
          }
          
          if (options.showLineNumbers) {
            output += `${i + 1}:`;
          }
          
          output += line;
          matches.push(output);
        }
        
        // Reset regex lastIndex for global regex
        regex.lastIndex = 0;
      }

      return matches;
    } catch {
      return [];
    }
  }

  private async searchDirectory(
    dirPath: string,
    regex: RegExp,
    options: { ignoreCase: boolean; showLineNumbers: boolean; recursive: boolean },
    baseCwd: string
  ): Promise<string[]> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });
      const matches: string[] = [];

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);
        
        if (entry.isFile()) {
          // Get relative path from base cwd for display
          const relativePath = entryPath.startsWith(baseCwd) 
            ? entryPath.slice(baseCwd.length + 1)
            : entryPath;
          
          const fileMatches = await this.searchFile(entryPath, regex, options, relativePath);
          matches.push(...fileMatches);
        } else if (entry.isDirectory() && options.recursive) {
          const dirMatches = await this.searchDirectory(entryPath, regex, options, baseCwd);
          matches.push(...dirMatches);
        }
      }

      return matches;
    } catch {
      return [];
    }
  }

  private parseArgs(args: string[]): { 
    options: { ignoreCase: boolean; showLineNumbers: boolean; recursive: boolean }; 
    pattern: string | null; 
    files: string[] 
  } {
    const options = { ignoreCase: false, showLineNumbers: false, recursive: false };
    const files: string[] = [];
    let pattern: string | null = null;
    let i = 0;

    while (i < args.length) {
      const arg = args[i];
      
      if (arg.startsWith('-') && arg !== '-') {
        // Parse options
        for (let j = 1; j < arg.length; j++) {
          const char = arg[j];
          switch (char) {
            case 'i':
              options.ignoreCase = true;
              break;
            case 'n':
              options.showLineNumbers = true;
              break;
            case 'r':
            case 'R':
              options.recursive = true;
              break;
            default:
              // Ignore unknown options
              break;
          }
        }
      } else {
        // First non-option argument is the pattern
        if (pattern === null) {
          pattern = arg;
        } else {
          files.push(arg);
        }
      }
      
      i++;
    }

    return { options, pattern, files };
  }
}