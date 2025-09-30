import { join } from "path-browserify";
import { z } from "zod";

import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface TextEditorViewParams {
  path: string;
  start_line?: number;
  end_line?: number;
}

export class TextEditorViewTool implements Tool<TextEditorViewParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "View the contents of a text file or directory";

  readonly inputSchema = z.object({
    path: z.string().describe(
      'Path of the file or directory to view, eg "src/index.ts" or "src/" for relative paths, or "/tmp/file.txt" for absolute paths',
    ),
    start_line: z.number().min(1).optional().describe(
      "Starting line number (1-indexed, inclusive). If provided, only show lines from this line onwards.",
    ),
    end_line: z.number().min(1).optional().describe(
      "Ending line number (1-indexed, inclusive). If provided, only show lines up to this line.",
    ),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: TextEditorViewParams): Promise<string> {
    const { path, start_line, end_line } = args;

    try {
      // Handle both absolute and relative paths
      let absolutePath: string;

      if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
        // It's an absolute path - use it directly
        absolutePath = path;
      } else {
        // It's a relative path - resolve it relative to the current working directory
        absolutePath = join(this.cwd, path);
      }

      // Check if the path is a directory
      const stats = await this.fs.stat(absolutePath);

      if (stats.isDirectory()) {
        // Special handling for /projects directory - only show project directories, not their contents
        const normalizedPath = absolutePath.replace(/\/$/, ''); // Remove trailing slash
        if (normalizedPath === '/projects') {
          const tree = await this.generateDirectoryTree(absolutePath, "", 1); // Only show immediate children
          return tree;
        }

        // If it's a directory, generate a tree-like listing
        // Note: start_line and end_line are ignored for directories
        const tree = await this.generateDirectoryTree(absolutePath);
        return tree;
      }

      // If it's a file, check if it's binary first
      if (await this.isBinaryFile(absolutePath)) {
        const stats = await this.fs.stat(absolutePath);
        const fileSize = this.formatFileSize(stats.size || 0);
        const fileExtension = this.getFileExtension(absolutePath);
        return `[Binary file: ${fileExtension.toUpperCase()} file, ${fileSize}]\n\nThis appears to be a binary file and cannot be displayed as text.`;
      }

      // If it's a text file, read and return its contents
      let content = await this.fs.readFile(absolutePath, "utf8");

      // Apply line filtering if start_line or end_line are provided
      if (start_line !== undefined || end_line !== undefined) {
        const lines = content.split('\n');

        // Validate line numbers first
        if (start_line !== undefined && start_line < 1) {
          throw new Error("Error: start_line must be >= 1");
        }

        if (end_line !== undefined && end_line < 1) {
          throw new Error("Error: end_line must be >= 1");
        }

        if (start_line !== undefined && end_line !== undefined && start_line > end_line) {
          throw new Error("Error: start_line cannot be greater than end_line");
        }

        if (start_line !== undefined && start_line > lines.length) {
          throw new Error(`Error: start_line ${start_line} is beyond the end of the file (${lines.length} lines)`);
        }

        const startIdx = start_line !== undefined ? start_line - 1 : 0;
        const endIdx = end_line !== undefined ? Math.min(lines.length, end_line) : lines.length;

        content = lines.slice(startIdx, endIdx).join('\n');
      }

      return content;
    } catch (error) {
      throw new Error(String(error));
    }
  }

  /**
   * Generate a tree-like directory listing
   */
  private async generateDirectoryTree(
    dirPath: string,
    prefix: string = "",
    maxDepth: number = 3,
    currentDepth: number = 0,
  ): Promise<string> {
    if (currentDepth >= maxDepth) {
      return prefix + "...\n";
    }

    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      // Sort entries: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      let result = "";

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!
        const isLastEntry = i === entries.length - 1;
        const connector = isLastEntry ? "└── " : "├── ";
        const nextPrefix = prefix + (isLastEntry ? "    " : "│   ");

        if (entry.isDirectory()) {
          result += prefix + connector + entry.name + "/\n";
          const subPath = join(dirPath, entry.name);
          result += await this.generateDirectoryTree(
            subPath,
            nextPrefix,
            maxDepth,
            currentDepth + 1,
          );
        } else {
          result += prefix + connector + entry.name + "\n";
        }
      }

      return result;
    } catch (error) {
      return prefix + `[Error reading directory: ${error}]\n`;
    }
  }



  /**
   * Check if a file is likely to be binary based on file extension and content sampling
   */
  private async isBinaryFile(filePath: string): Promise<boolean> {
    // Check file extension first for known binary types
    const extension = this.getFileExtension(filePath).toLowerCase();
    const binaryExtensions = new Set([
      // Images
      'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'svg', 'ico', 'avif',
      // Videos
      'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', '3gp', 'm4v',
      // Audio
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus',
      // Archives
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz4', 'zst',
      // Executables
      'exe', 'dll', 'so', 'dylib', 'bin', 'app', 'deb', 'rpm', 'msi',
      // Documents (binary formats)
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
      // Fonts
      'ttf', 'otf', 'woff', 'woff2', 'eot',
      // Other binary formats
      'sqlite', 'db', 'sqlite3', 'pyc', 'class', 'jar', 'war', 'ear',
      // Development
      'node_modules', 'git', 'gitignore', 'lock'
    ]);

    if (binaryExtensions.has(extension)) {
      return true;
    }

    try {
      // For files without clear binary extensions, sample the first chunk of content
      // Read as Uint8Array to check for null bytes and non-printable characters
      const bytes = await this.fs.readFile(filePath);

      // Check first 1024 bytes (or entire file if smaller)
      const sampleSize = Math.min(1024, bytes.length);

      // Count null bytes and non-printable characters
      let nullBytes = 0;
      let nonPrintableBytes = 0;

      for (let i = 0; i < sampleSize; i++) {
        const byte = bytes[i];

        if (byte === 0) {
          nullBytes++;
        }

        // Consider bytes outside printable ASCII range (except common whitespace)
        // Printable ASCII: 32-126, plus tab (9), newline (10), carriage return (13)
        if (byte !== 9 && byte !== 10 && byte !== 13 && (byte < 32 || byte > 126)) {
          nonPrintableBytes++;
        }
      }

      // If more than 1% null bytes or more than 30% non-printable, consider it binary
      const nullRatio = nullBytes / sampleSize;
      const nonPrintableRatio = nonPrintableBytes / sampleSize;

      return nullRatio > 0.01 || nonPrintableRatio > 0.3;

    } catch {
      // If we can't read the file, assume it might be binary
      return true;
    }
  }

  /**
   * Get file extension from path
   */
  private getFileExtension(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

    // If there's no dot, or the dot is before the last slash (hidden file), return empty string
    if (lastDotIndex === -1 || lastDotIndex < lastSlashIndex) {
      return '';
    }

    return filePath.slice(lastDotIndex + 1);
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }
};