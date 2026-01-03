import { join, dirname, basename, normalize } from "path-browserify";
import JSZip from "jszip";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'zip' command
 * Create ZIP archives from files and directories
 */
export class ZipCommand implements ShellCommand {
  name = 'zip';
  description = 'Create ZIP archives';
  usage = 'zip [-r] [-q] archive.zip file1 [file2 ...]\n  -r  Recurse into directories\n  -q  Quiet mode';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing archive operand\nUsage: ${this.usage}`);
    }

    let archivePath = '';
    let recursive = false;
    let quiet = false;
    const filesToAdd: string[] = [];

    // Parse command line options
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-r') {
        recursive = true;
      } else if (arg === '-q') {
        quiet = true;
      } else if (arg === '-rq' || arg === '-qr') {
        recursive = true;
        quiet = true;
      } else if (arg.startsWith('-')) {
        // Check for combined flags like -rq
        const flags = arg.slice(1);
        let validFlags = true;
        for (const flag of flags) {
          if (flag === 'r') recursive = true;
          else if (flag === 'q') quiet = true;
          else {
            validFlags = false;
            break;
          }
        }
        if (!validFlags) {
          return createErrorResult(`${this.name}: invalid option '${arg}'\nUsage: ${this.usage}`);
        }
      } else if (!archivePath) {
        // First non-option is the archive path
        archivePath = arg;
      } else {
        // Remaining arguments are files to add
        filesToAdd.push(arg);
      }
    }

    if (!archivePath) {
      return createErrorResult(`${this.name}: no archive specified\nUsage: ${this.usage}`);
    }

    if (filesToAdd.length === 0) {
      return createErrorResult(`${this.name}: no files to add\nUsage: ${this.usage}`);
    }

    // Ensure archive has .zip extension
    if (!archivePath.toLowerCase().endsWith('.zip')) {
      archivePath += '.zip';
    }

    try {
      // Resolve archive path
      const absoluteArchivePath = this.resolvePath(archivePath, cwd);

      // Security check
      if (!this.isPathAllowed(absoluteArchivePath, cwd)) {
        return createErrorResult(`${this.name}: cannot create archive outside allowed paths`);
      }

      // Create parent directory if needed
      const parentDir = dirname(absoluteArchivePath);
      try {
        await this.fs.stat(parentDir);
      } catch {
        await this.fs.mkdir(parentDir, { recursive: true });
      }

      const zip = new JSZip();
      const addedFiles: string[] = [];
      const errors: string[] = [];

      // Add each file/directory to the archive
      for (const filePath of filesToAdd) {
        const absolutePath = this.resolvePath(filePath, cwd);

        try {
          const stats = await this.fs.stat(absolutePath);

          if (stats.isDirectory()) {
            if (recursive) {
              await this.addDirectoryToZip(zip, absolutePath, basename(absolutePath), addedFiles, quiet);
            } else {
              errors.push(`${this.name}: ${filePath}: Is a directory (use -r to include)`);
            }
          } else if (stats.isFile()) {
            const content = await this.fs.readFile(absolutePath);
            const entryName = basename(absolutePath);
            zip.file(entryName, content);
            if (!quiet) {
              addedFiles.push(`  adding: ${entryName}`);
            }
          }
        } catch {
          errors.push(`${this.name}: ${filePath}: No such file or directory`);
        }
      }

      if (addedFiles.length === 0 && errors.length > 0) {
        return createErrorResult(errors.join('\n'));
      }

      // Generate the ZIP file
      const zipContent = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Write the ZIP file
      await this.fs.writeFile(absoluteArchivePath, zipContent);

      // Build output
      let output = '';
      if (!quiet) {
        output = addedFiles.join('\n');
        if (output) {
          output += '\n';
        }
        const sizeKB = (zipContent.length / 1024).toFixed(1);
        output += `Created: ${archivePath} (${sizeKB} KB)`;
      }

      if (errors.length > 0) {
        return createErrorResult(output + (output ? '\n' : '') + errors.join('\n'));
      }

      return createSuccessResult(output);

    } catch (error) {
      if (error instanceof Error) {
        return createErrorResult(`${this.name}: ${error.message}`);
      }
      return createErrorResult(`${this.name}: Unknown error`);
    }
  }

  /**
   * Recursively add a directory to the ZIP archive
   */
  private async addDirectoryToZip(
    zip: JSZip,
    dirPath: string,
    zipPath: string,
    addedFiles: string[],
    quiet: boolean
  ): Promise<void> {
    const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const entryZipPath = join(zipPath, entry.name);

      if (entry.isDirectory()) {
        // Add directory entry and recurse
        zip.folder(entryZipPath);
        await this.addDirectoryToZip(zip, fullPath, entryZipPath, addedFiles, quiet);
      } else if (entry.isFile()) {
        try {
          const content = await this.fs.readFile(fullPath);
          zip.file(entryZipPath, content);
          if (!quiet) {
            addedFiles.push(`  adding: ${entryZipPath}`);
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  /**
   * Resolve a path relative to cwd
   */
  private resolvePath(filePath: string, cwd: string): string {
    if (filePath.startsWith('/') || filePath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(filePath)) {
      return normalize(filePath);
    }
    return normalize(join(cwd, filePath));
  }

  /**
   * Check if a path is within allowed directories (cwd or /tmp)
   */
  private isPathAllowed(targetPath: string, cwd: string): boolean {
    const normalizedPath = normalize(targetPath);
    const normalizedCwd = normalize(cwd);
    const tmpPath = '/tmp';

    const absolutePath = normalizedPath.startsWith('/') ? normalizedPath : normalize(join(normalizedCwd, normalizedPath));
    const absoluteCwd = normalizedCwd.startsWith('/') ? normalizedCwd : '/' + normalizedCwd;

    return absolutePath.startsWith(absoluteCwd + '/') ||
           absolutePath === absoluteCwd ||
           absolutePath.startsWith(tmpPath + '/') ||
           absolutePath === tmpPath;
  }
}
