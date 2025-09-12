import { join, dirname, basename } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'mv' command
 * Move/rename files and directories
 */
export class MvCommand implements ShellCommand {
  name = 'mv';
  description = 'Move/rename files and directories';
  usage = 'mv source... destination';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    if (args.length < 2) {
      return createErrorResult(`${this.name}: missing file operand\nUsage: ${this.usage}`);
    }

    try {
      const sources = args.slice(0, -1);
      const destination = args[args.length - 1];

      // Check for absolute paths
      for (const path of [...sources, destination]) {
        if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
          return createErrorResult(`${this.name}: absolute paths are not supported: ${path}`);
        }
      }

      const destAbsolutePath = join(cwd, destination);

      // Check if destination exists and is a directory
      let destIsDir = false;
      try {
        const destStats = await this.fs.stat(destAbsolutePath);
        destIsDir = destStats.isDirectory();
      } catch {
        // Destination doesn't exist, that's fine for single file moves
      }

      // If multiple sources, destination must be a directory
      if (sources.length > 1 && !destIsDir) {
        return createErrorResult(`${this.name}: target '${destination}' is not a directory`);
      }

      for (const source of sources) {
        try {
          const sourceAbsolutePath = join(cwd, source);

          // Check if source exists
          await this.fs.stat(sourceAbsolutePath);

          let targetPath: string;
          if (destIsDir) {
            // Move into directory
            targetPath = join(destAbsolutePath, basename(source));
          } else {
            // Move/rename to specific path
            targetPath = destAbsolutePath;
          }

          // Check if target already exists
          try {
            await this.fs.stat(targetPath);
            // Target exists - in real mv, this would overwrite, but let's be safe
            return createErrorResult(`${this.name}: cannot move '${source}' to '${destination}': File exists`);
          } catch {
            // Target doesn't exist, good to proceed
          }

          // Ensure target directory exists
          const targetDir = dirname(targetPath);
          try {
            await this.fs.stat(targetDir);
          } catch {
            await this.fs.mkdir(targetDir, { recursive: true });
          }

          // Perform the move (rename)
          await this.fs.rename(sourceAbsolutePath, targetPath);

        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: cannot stat '${source}': No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: cannot move '${source}': Permission denied`);
            } else {
              return createErrorResult(`${this.name}: cannot move '${source}': ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: cannot move '${source}': Unknown error`);
          }
        }
      }

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

