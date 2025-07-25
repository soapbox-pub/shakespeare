import { join } from "@std/path";
import ignore from "ignore";
import { z } from "zod";

import type { Tool, CallToolResult } from "./Tool";
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

  readonly parameters = z.object({
    path: z.string().describe(
      'Path of the file or directory to view, eg "src/index.ts" or "src/"',
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

  async execute(args: TextEditorViewParams): Promise<CallToolResult> {
    const { path, start_line, end_line } = args;

    try {
      // Check for absolute paths and provide helpful error
      if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
        return {
          content: [{
            type: "text",
            text: `❌ Absolute paths are not supported.\n\nThe path "${path}" appears to be an absolute path.\n\n💡 Please use a relative path instead. Examples:\n- "src/index.ts" (relative to current directory)\n- "./src/index.ts" (explicit relative path)\n- "../other-project/src/index.ts" (relative to parent directory)\n\nCurrent working directory: ${this.cwd}`,
          }],
          isError: true,
        };
      }

      const absolutePath = join(this.cwd, path);

      // Check if the path is a directory
      const stats = await this.fs.stat(absolutePath);

      if (stats.isDirectory()) {
        // If it's a directory, generate a tree-like listing
        // Note: start_line and end_line are ignored for directories
        const tree = await this.generateDirectoryTree(absolutePath);
        return {
          content: [{
            type: "text",
            text: tree,
          }],
          isError: false,
        };
      }

      // If it's a file, read and return its contents
      let content = await this.fs.readFile(absolutePath, "utf8");

      // Apply line filtering if start_line or end_line are provided
      if (start_line !== undefined || end_line !== undefined) {
        const lines = content.split('\n');

        // Validate line numbers first
        if (start_line !== undefined && start_line < 1) {
          return {
            content: [{
              type: "text",
              text: "Error: start_line must be >= 1",
            }],
            isError: true,
          };
        }

        if (end_line !== undefined && end_line < 1) {
          return {
            content: [{
              type: "text",
              text: "Error: end_line must be >= 1",
            }],
            isError: true,
          };
        }

        if (start_line !== undefined && end_line !== undefined && start_line > end_line) {
          return {
            content: [{
              type: "text",
              text: "Error: start_line cannot be greater than end_line",
            }],
            isError: true,
          };
        }

        if (start_line !== undefined && start_line > lines.length) {
          return {
            content: [{
              type: "text",
              text: `Error: start_line ${start_line} is beyond the end of the file (${lines.length} lines)`,
            }],
            isError: true,
          };
        }

        const startIdx = start_line !== undefined ? start_line - 1 : 0;
        const endIdx = end_line !== undefined ? Math.min(lines.length, end_line) : lines.length;

        content = lines.slice(startIdx, endIdx).join('\n');
      }

      return {
        content: [{
          type: "text",
          text: content,
        }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: String(error),
        }],
        isError: true,
      };
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
    ignoreFilter?: (path: string) => boolean,
  ): Promise<string> {
    if (currentDepth >= maxDepth) {
      return prefix + "...\n";
    }

    // Create ignore filter on first call (root level)
    if (!ignoreFilter) {
      ignoreFilter = await this.createIgnoreFilter();
    }

    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      // Filter entries using gitignore patterns
      const filteredEntries = entries.filter((entry) => {
        // Calculate relative path from the project root (cwd)
        const fullEntryPath = join(dirPath, entry.name);
        const entryPath = this.makeRelativeToCwd(fullEntryPath);
        return ignoreFilter!(entryPath);
      });

      // Sort entries: directories first, then files, both alphabetically
      filteredEntries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      let result = "";

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i]!;
        const isLastEntry = i === filteredEntries.length - 1;
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
            ignoreFilter,
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
   * Create an ignore filter based on .gitignore files
   */
  private async createIgnoreFilter(): Promise<(path: string) => boolean> {
    const ig = ignore();

    // Always ignore .git directory
    ig.add(".git");

    // Default ignore patterns if no .gitignore is found
    const defaultIgnorePatterns = [
      "node_modules",
      "dist",
      "build",
      ".next",
      ".tmp",
    ];

    try {
      // Try to read .gitignore file
      const gitignoreContent = await this.fs.readFile(".gitignore", "utf8");
      ig.add(gitignoreContent);
    } catch {
      // If there's an error reading .gitignore, fall back to defaults
      ig.add(defaultIgnorePatterns);
    }

    return (path: string) => !ig.ignores(path);
  }

  /**
   * Convert an absolute path to a relative path from the current working directory
   */
  private makeRelativeToCwd(absolutePath: string): string {
    // Handle relative paths that start with "./"
    if (absolutePath.startsWith('./')) {
      return absolutePath.slice(2); // Remove "./" prefix
    }

    // Handle the current directory case
    if (absolutePath === '.') {
      return '.';
    }

    // If the path starts with the cwd, remove the cwd prefix
    if (absolutePath.startsWith(this.cwd)) {
      let relativePath = absolutePath.slice(this.cwd.length);
      // Remove leading slash if present
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }
      // Return '.' for empty path (current directory)
      return relativePath || '.';
    }

    // If it doesn't start with cwd, just return the path as-is
    // This handles cases where we might have relative paths already
    return absolutePath;
  }
};