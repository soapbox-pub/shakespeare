import { join, basename } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'ls' command
 * List directory contents
 */
export class LsCommand implements ShellCommand {
  name = 'ls';
  description = 'List directory contents';
  usage = 'ls [-la] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      // Parse options and paths
      const { options, paths } = this.parseArgs(args);
      const targetPaths = paths.length > 0 ? paths : ['.'];

      const outputs: string[] = [];

      for (const path of targetPaths) {
        try {
          // Handle absolute paths
          if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
            return createErrorResult(`${this.name}: absolute paths are not supported: ${path}`);
          }

          const absolutePath = join(cwd, path);
          const stats = await this.fs.stat(absolutePath);

          if (stats.isFile()) {
            // If it's a file, just show the filename
            if (options.long) {
              const size = stats.size || 0;
              const mtime = stats.mtimeMs ? new Date(stats.mtimeMs).toISOString().slice(0, 16).replace('T', ' ') : 'unknown';
              outputs.push(`-rw-r--r-- 1 user user ${size.toString().padStart(8)} ${mtime} ${basename(path)}`);
            } else {
              outputs.push(basename(path));
            }
          } else if (stats.isDirectory()) {
            // List directory contents
            const entries = await this.fs.readdir(absolutePath, { withFileTypes: true });
            
            // Filter hidden files unless -a flag is used
            const filteredEntries = options.all ? entries : entries.filter(entry => !entry.name.startsWith('.'));
            
            // Sort entries: directories first (if not -l), then alphabetically
            filteredEntries.sort((a, b) => {
              if (!options.long) {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
              }
              return a.name.localeCompare(b.name);
            });

            if (targetPaths.length > 1) {
              outputs.push(`${path}:`);
            }

            if (options.long) {
              // Long format listing
              const longEntries: string[] = [];
              
              for (const entry of filteredEntries) {
                try {
                  const entryPath = join(absolutePath, entry.name);
                  const entryStats = await this.fs.stat(entryPath);
                  const size = entryStats.size || 0;
                  const mtime = entryStats.mtimeMs ? 
                    new Date(entryStats.mtimeMs).toISOString().slice(0, 16).replace('T', ' ') : 
                    'unknown      ';
                  
                  const permissions = entry.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--';
                  const name = entry.isDirectory() ? entry.name + '/' : entry.name;
                  
                  longEntries.push(`${permissions} 1 user user ${size.toString().padStart(8)} ${mtime} ${name}`);
                } catch {
                  // If we can't stat the entry, show basic info
                  const permissions = entry.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--';
                  const name = entry.isDirectory() ? entry.name + '/' : entry.name;
                  longEntries.push(`${permissions} 1 user user        0 unknown       ${name}`);
                }
              }
              
              outputs.push(longEntries.join('\n'));
            } else {
              // Simple format
              const names = filteredEntries.map(entry => 
                entry.isDirectory() ? entry.name + '/' : entry.name
              );
              outputs.push(names.join('  '));
            }

            if (targetPaths.length > 1 && path !== targetPaths[targetPaths.length - 1]) {
              outputs.push(''); // Empty line between directories
            }
          }
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: cannot access '${path}': No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: cannot access '${path}': Permission denied`);
            } else {
              return createErrorResult(`${this.name}: cannot access '${path}': ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: cannot access '${path}': Unknown error`);
          }
        }
      }

      return createSuccessResult(outputs.join('\n') + (outputs.length > 0 ? '\n' : ''));

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { options: { long: boolean; all: boolean }; paths: string[] } {
    const options = { long: false, all: false };
    const paths: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'l':
              options.long = true;
              break;
            case 'a':
              options.all = true;
              break;
            default:
              // Ignore unknown options for now
              break;
          }
        }
      } else {
        paths.push(arg);
      }
    }

    return { options, paths };
  }
}