import { join, dirname, basename } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";
import { isAbsolutePath, validateWritePath } from "../security";

/**
 * Implementation of the 'cp' command
 * Copy files and directories
 */
export class CpCommand implements ShellCommand {
  name = 'cp';
  description = 'Copy files and directories';
  usage = 'cp [-r] source... destination';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    if (args.length < 2) {
      return createErrorResult(`${this.name}: missing file operand\nUsage: ${this.usage}`);
    }

    try {
      const { options, paths } = this.parseArgs(args);

      if (paths.length < 2) {
        return createErrorResult(`${this.name}: missing destination file operand after '${paths[0] || ''}'\nUsage: ${this.usage}`);
      }

      const sources = paths.slice(0, -1);
      const destination = paths[paths.length - 1];

      // Check write permissions for destination (sources can be read from anywhere)
      try {
        validateWritePath(destination, this.name);
      } catch (error) {
        return createErrorResult(error instanceof Error ? error.message : 'Unknown error');
      }

      // Handle both absolute and relative paths for destination
      let destAbsolutePath: string;
      if (isAbsolutePath(destination)) {
        destAbsolutePath = destination;
      } else {
        destAbsolutePath = join(cwd, destination);
      }

      // Check if destination exists and is a directory
      let destIsDir = false;
      try {
        const destStats = await this.fs.stat(destAbsolutePath);
        destIsDir = destStats.isDirectory();
      } catch {
        // Destination doesn't exist, that's fine
      }

      // If multiple sources, destination must be a directory
      if (sources.length > 1 && !destIsDir) {
        return createErrorResult(`${this.name}: target '${destination}' is not a directory`);
      }

      for (const source of sources) {
        try {
          // Handle both absolute and relative paths for source
          let sourceAbsolutePath: string;
          if (isAbsolutePath(source)) {
            sourceAbsolutePath = source;
          } else {
            sourceAbsolutePath = join(cwd, source);
          }
          const sourceStats = await this.fs.stat(sourceAbsolutePath);

          let targetPath: string;
          if (destIsDir) {
            // Copy into directory
            targetPath = join(destAbsolutePath, basename(source));
          } else {
            // Copy to specific file
            targetPath = destAbsolutePath;
          }

          if (sourceStats.isDirectory()) {
            if (!options.recursive) {
              return createErrorResult(`${this.name}: -r not specified; omitting directory '${source}'`);
            }

            // Recursive directory copy
            await this.copyDirectoryRecursive(sourceAbsolutePath, targetPath);
          } else {
            // Copy file
            await this.copyFile(sourceAbsolutePath, targetPath);
          }

        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: cannot stat '${source}': No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: cannot access '${source}': Permission denied`);
            } else {
              return createErrorResult(`${this.name}: cannot copy '${source}': ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: cannot copy '${source}': Unknown error`);
          }
        }
      }

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      // Ensure target directory exists
      const targetDir = dirname(targetPath);
      try {
        await this.fs.stat(targetDir);
      } catch {
        await this.fs.mkdir(targetDir, { recursive: true });
      }

      // Read source file and write to target
      const content = await this.fs.readFile(sourcePath);
      await this.fs.writeFile(targetPath, content);
    } catch (error) {
      throw new Error(`Failed to copy file ${sourcePath} to ${targetPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async copyDirectoryRecursive(sourcePath: string, targetPath: string): Promise<void> {
    try {
      // Create target directory
      await this.fs.mkdir(targetPath, { recursive: true });

      // Get all entries in source directory
      const entries = await this.fs.readdir(sourcePath, { withFileTypes: true });

      // Copy each entry
      for (const entry of entries) {
        const sourceEntryPath = join(sourcePath, entry.name);
        const targetEntryPath = join(targetPath, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectoryRecursive(sourceEntryPath, targetEntryPath);
        } else {
          await this.copyFile(sourceEntryPath, targetEntryPath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to copy directory ${sourcePath} to ${targetPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): { options: { recursive: boolean }; paths: string[] } {
    const options = { recursive: false };
    const paths: string[] = [];

    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Parse options
        for (let i = 1; i < arg.length; i++) {
          const char = arg[i];
          switch (char) {
            case 'r':
            case 'R':
              options.recursive = true;
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