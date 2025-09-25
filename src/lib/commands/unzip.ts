import { join, dirname, normalize } from "path-browserify";
import JSZip from "jszip";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'unzip' command
 * Extract files from ZIP archives
 */
export class UnzipCommand implements ShellCommand {
  name = 'unzip';
  description = 'Extract files from ZIP archives';
  usage = 'unzip [-d directory] [-o] [-l] [-q] archive.zip';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing archive operand\nUsage: ${this.usage}`);
    }

    let archivePath = '';
    let extractDir = cwd;
    let overwrite = false;
    let listOnly = false;
    let quiet = false;

    // Parse command line options
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-d' && i + 1 < args.length) {
        // Extract to specific directory
        extractDir = args[i + 1];
        i++; // Skip next argument
      } else if (arg === '-o') {
        // Overwrite existing files
        overwrite = true;
      } else if (arg === '-l') {
        // List archive contents only
        listOnly = true;
      } else if (arg === '-q') {
        // Quiet mode - suppress output
        quiet = true;
      } else if (arg.startsWith('-')) {
        return createErrorResult(`${this.name}: invalid option '${arg}'\nUsage: ${this.usage}`);
      } else {
        // This should be the archive path
        archivePath = arg;
      }
    }

    if (!archivePath) {
      return createErrorResult(`${this.name}: no archive specified\nUsage: ${this.usage}`);
    }

    try {
      // Resolve archive path
      let absoluteArchivePath: string;
      if (archivePath.startsWith('/') || archivePath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(archivePath)) {
        absoluteArchivePath = archivePath;
      } else {
        absoluteArchivePath = join(cwd, archivePath);
      }

      // Check if archive exists
      try {
        const stats = await this.fs.stat(absoluteArchivePath);
        if (stats.isDirectory()) {
          return createErrorResult(`${this.name}: ${archivePath}: Is a directory`);
        }
      } catch {
        return createErrorResult(`${this.name}: ${archivePath}: No such file or directory`);
      }

      // Read the ZIP file
      const zipData = await this.fs.readFile(absoluteArchivePath);
      const zip = await JSZip.loadAsync(zipData);

      // Resolve extraction directory
      let absoluteExtractDir: string;
      if (extractDir.startsWith('/') || extractDir.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(extractDir)) {
        absoluteExtractDir = extractDir;
      } else {
        absoluteExtractDir = join(cwd, extractDir);
      }

      // Security check: ensure extraction directory is within allowed paths
      if (!this.isPathAllowed(absoluteExtractDir, cwd)) {
        return createErrorResult(`${this.name}: extraction directory '${extractDir}' is outside allowed paths (cwd or /tmp)`);
      }

      if (listOnly) {
        // List contents only
        const entries: string[] = [];
        zip.forEach((relativePath, file) => {
          const date = file.date || new Date();
          const type = file.dir ? 'd' : '-';
          const sizeStr = file.dir ? '0' : '?';

          entries.push(`${type}rw-r--r-- 1 user user ${sizeStr.padStart(8)} ${date.toISOString().slice(0, 19).replace('T', ' ')} ${relativePath}`);
        });

        return createSuccessResult(`Archive: ${archivePath}\n${entries.join('\n')}`);
      }

      // Create extraction directory if it doesn't exist
      try {
        await this.fs.stat(absoluteExtractDir);
      } catch {
        await this.fs.mkdir(absoluteExtractDir, { recursive: true });
      }

      const extractedFiles: string[] = [];
      const errors: string[] = [];

      // Extract all files
      for (const [relativePath, file] of Object.entries(zip.files)) {
        const extractPath = join(absoluteExtractDir, relativePath);

        // Security check: ensure each file path is within allowed directories
        if (!this.isPathAllowed(extractPath, cwd)) {
          errors.push(`${this.name}: ${relativePath}: Path is outside allowed directories (skipped for security)`);
          continue;
        }

        try {
          if (file.dir) {
            // Create directory
            await this.fs.mkdir(extractPath, { recursive: true });
            if (!quiet) {
              extractedFiles.push(`  creating: ${relativePath}`);
            }
          } else {
            // Check if file exists and handle overwrite
            if (!overwrite) {
              try {
                await this.fs.stat(extractPath);
                errors.push(`${this.name}: ${relativePath}: File exists (use -o to overwrite)`);
                continue;
              } catch {
                // File doesn't exist, proceed with extraction
              }
            }

            // Create parent directories if needed
            const parentDir = dirname(extractPath);
            try {
              await this.fs.stat(parentDir);
            } catch {
              await this.fs.mkdir(parentDir, { recursive: true });
            }

            // Extract file content
            const content = await file.async('uint8array');
            await this.fs.writeFile(extractPath, content);
            if (!quiet) {
              extractedFiles.push(`  inflating: ${relativePath}`);
            }
          }
        } catch (error) {
          errors.push(`${this.name}: ${relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      let output = '';
      if (!quiet) {
        output = `Archive: ${archivePath}\n`;
        if (extractedFiles.length > 0) {
          output += extractedFiles.join('\n');
        }
      }

      if (errors.length > 0) {
        if (!quiet && extractedFiles.length > 0) {
          output += '\n';
        }
        return createErrorResult(output + '\n' + errors.join('\n'));
      }

      return createSuccessResult(output);

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('corrupted') || error.message.includes('invalid')) {
          return createErrorResult(`${this.name}: ${archivePath}: Archive is corrupted or invalid`);
        } else {
          return createErrorResult(`${this.name}: ${archivePath}: ${error.message}`);
        }
      } else {
        return createErrorResult(`${this.name}: ${archivePath}: Unknown error`);
      }
    }
  }

  /**
   * Check if a path is within allowed extraction directories (cwd or /tmp and their subdirectories)
   */
  private isPathAllowed(extractPath: string, cwd: string): boolean {
    // Normalize the paths without using resolve() since we're in browser environment
    const normalizedPath = normalize(extractPath);
    const normalizedCwd = normalize(cwd);
    const tmpPath = '/tmp';

    // Ensure paths are absolute for comparison
    const absolutePath = normalizedPath.startsWith('/') ? normalizedPath : normalize(join(normalizedCwd, normalizedPath));
    const absoluteCwd = normalizedCwd.startsWith('/') ? normalizedCwd : '/' + normalizedCwd;

    // Check if path is within cwd or /tmp
    return absolutePath.startsWith(absoluteCwd + '/') ||
           absolutePath === absoluteCwd ||
           absolutePath.startsWith(tmpPath + '/') ||
           absolutePath === tmpPath;
  }
}