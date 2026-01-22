import { join } from "path-browserify";
import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface ReadParams {
  filePath: string;
  offset?: number;
  limit?: number;
}

interface ReadToolOptions {
  projectsPath?: string;
  defaultReadLimit?: number;
  maxLineLength?: number;
}

export class ReadTool implements Tool<ReadParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private projectsPath: string;
  private defaultReadLimit: number;
  private maxLineLength: number;

  readonly description = `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The filePath parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than 2000 characters will be truncated
- Results are returned using cat -n format, with line numbers starting at 1
- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.
- You can read image files using this tool.`;

  readonly inputSchema = z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.coerce.number().describe("The line number to start reading from (0-based)").optional(),
    limit: z.coerce.number().describe("The number of lines to read (defaults to 2000)").optional(),
  });

  constructor(fs: JSRuntimeFS, cwd: string, options?: ReadToolOptions) {
    this.fs = fs;
    this.cwd = cwd;
    this.projectsPath = options?.projectsPath || '/projects';
    this.defaultReadLimit = options?.defaultReadLimit || 2000;
    this.maxLineLength = options?.maxLineLength || 2000;
  }

  async execute(args: ReadParams): Promise<ToolResult> {
    let filepath = args.filePath;
    
    // Handle both absolute and relative paths
    if (!filepath.startsWith('/') && !filepath.startsWith('\\') && !/^[A-Za-z]:[\\/]/.test(filepath)) {
      filepath = join(this.cwd, filepath);
    }

    try {
      const file = await this.fs.stat(filepath);

      // Handle directory viewing
      if (file.isDirectory()) {
        // Special handling for projects directory - only show project directories, not their contents
        const normalizedPath = filepath.replace(/\/$/, ''); // Remove trailing slash
        if (normalizedPath === this.projectsPath) {
          const tree = await this.generateDirectoryTree(filepath, "", 1); // Only show immediate children
          return { content: tree };
        }

        // Check if we're starting from a .git directory
        const isGitRoot = filepath.endsWith('/.git') || filepath === '.git';

        // If it's a directory, generate a tree-like listing
        const tree = await this.generateDirectoryTree(filepath, "", 3, 0, isGitRoot);
        return { content: tree };
      }

      // Check if it's an image file
      const isImage = this.isImageFile(filepath);
      if (isImage) {
        // Read image as base64
        const bytes = await this.fs.readFile(filepath);
        const base64 = this.arrayBufferToBase64(bytes);
        const ext = this.getFileExtension(filepath).toLowerCase();
        const mimeType = this.getMimeType(ext);
        
        // Return base64 data URL in the content
        return {
          content: `[Image file: ${ext.toUpperCase()} file]\n\nImage read successfully.\n\nData URL: data:${mimeType};base64,${base64}`,
        };
      }

      // Check if it's binary
      if (await this.isBinaryFile(filepath)) {
        const stats = await this.fs.stat(filepath);
        const fileSize = this.formatFileSize(stats.size || 0);
        const fileExtension = this.getFileExtension(filepath);
        return {
          content: `[Binary file: ${fileExtension.toUpperCase()} file, ${fileSize}]\n\nThis appears to be a binary file and cannot be displayed as text.`
        };
      }

      // Read text file
      const content = await this.fs.readFile(filepath, "utf8");
      const limit = args.limit ?? this.defaultReadLimit;
      const offset = args.offset || 0;
      const lines = content.split("\n");

      // Apply line filtering
      const raw: string[] = [];
      for (let i = offset; i < Math.min(lines.length, offset + limit); i++) {
        const line = lines[i].length > this.maxLineLength 
          ? lines[i].substring(0, this.maxLineLength) + "..." 
          : lines[i];
        raw.push(line);
      }

      // Format with line numbers (cat -n format, 1-indexed)
      const formatted = raw.map((line, index) => {
        return `${(index + offset + 1).toString().padStart(5, " ")}| ${line}`;
      });

      let output = "<file>\n";
      output += formatted.join("\n");

      const totalLines = lines.length;
      const lastReadLine = offset + raw.length;
      const hasMoreLines = totalLines > lastReadLine;

      if (hasMoreLines) {
        output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`;
      } else {
        output += `\n\n(End of file - total ${totalLines} lines)`;
      }
      output += "\n</file>";

      return { content: output };

    } catch {
      // File not found - try to suggest similar files
      try {
        const dir = filepath.split('/').slice(0, -1).join('/') || '/';
        const base = filepath.split('/').pop() || '';
        const dirEntries = await this.fs.readdir(dir);
        
        const suggestions = dirEntries
          .filter(entry => 
            entry.toLowerCase().includes(base.toLowerCase()) || 
            base.toLowerCase().includes(entry.toLowerCase())
          )
          .map(entry => join(dir, entry))
          .slice(0, 3);

        if (suggestions.length > 0) {
          throw new Error(`File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`);
        }
      } catch {
        // Ignore suggestion errors
      }

      throw new Error(`File not found: ${filepath}`);
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
    isGitRoot: boolean = false,
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

          // Special handling for .git directories - don't traverse unless we started from .git
          if (entry.name === '.git' && !isGitRoot) {
            result += nextPrefix + "...\n";
          } else {
            const subPath = join(dirPath, entry.name);
            result += await this.generateDirectoryTree(
              subPath,
              nextPrefix,
              maxDepth,
              currentDepth + 1,
              isGitRoot,
            );
          }
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
   * Check if a file is an image based on extension
   */
  private isImageFile(filePath: string): boolean {
    const extension = this.getFileExtension(filePath).toLowerCase();
    const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'avif']);
    return imageExtensions.has(extension);
  }

  /**
   * Get MIME type for image extensions
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'avif': 'image/avif',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Check if a file is likely to be binary based on file extension and content sampling
   */
  private async isBinaryFile(filePath: string): Promise<boolean> {
    // Check file extension first for known binary types
    const extension = this.getFileExtension(filePath).toLowerCase();
    const binaryExtensions = new Set([
      // Images (already handled separately)
      'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'ico', 'avif',
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
      'sqlite', 'db', 'sqlite3', 'pyc', 'class', 'jar', 'war', 'ear', 'wasm',
    ]);

    if (binaryExtensions.has(extension)) {
      return true;
    }

    try {
      // For files without clear binary extensions, sample the first chunk of content
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
}
