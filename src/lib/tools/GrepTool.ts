import { join } from "path-browserify";
import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface GrepParams {
  pattern: string;
  path?: string;
  include?: string;
}

interface GrepToolOptions {
  maxLineLength?: number;
  resultLimit?: number;
}

export class GrepTool implements Tool<GrepParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private maxLineLength: number;
  private resultLimit: number;

  readonly description = `- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths and line numbers with at least one match sorted by modification time
- Use this tool when you need to find files containing specific patterns
- If you need to identify/count the number of matches within files, use the shell tool with \`rg\` (ripgrep) directly. Do NOT use \`grep\`.
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the task tool instead`;

  readonly inputSchema = z.object({
    pattern: z.string().describe("The regex pattern to search for in file contents"),
    path: z.string().optional().describe("The directory to search in. Defaults to the current working directory."),
    include: z.string().optional().describe('File pattern to include in the search (e.g. "*.js", "*.{ts,tsx}")'),
  });

  constructor(fs: JSRuntimeFS, cwd: string, options?: GrepToolOptions) {
    this.fs = fs;
    this.cwd = cwd;
    this.maxLineLength = options?.maxLineLength || 2000;
    this.resultLimit = options?.resultLimit || 100;
  }

  async execute(args: GrepParams): Promise<ToolResult> {
    if (!args.pattern) {
      throw new Error("pattern is required");
    }

    // If path is absolute, use it directly; otherwise join with cwd
    const searchPath = args.path 
      ? (args.path.startsWith('/') ? args.path : join(this.cwd, args.path))
      : this.cwd;

    try {
      // Check if search path exists
      const stats = await this.fs.stat(searchPath);
      if (!stats.isDirectory()) {
        throw new Error(`Not a directory: ${searchPath}`);
      }

      // Create regex from pattern
      let regex: RegExp;
      try {
        regex = new RegExp(args.pattern, 'g');
      } catch {
        throw new Error(`Invalid regex pattern: ${args.pattern}`);
      }

      // Perform the search
      const matches = await this.searchFiles(searchPath, regex, args.include);

      // Sort by modification time (most recent first)
      matches.sort((a, b) => b.modTime - a.modTime);

      // Truncate results if needed
      const truncated = matches.length > this.resultLimit;
      const finalMatches = truncated ? matches.slice(0, this.resultLimit) : matches;

      if (finalMatches.length === 0) {
        return { content: "No files found" };
      }

      // Format output
      const outputLines = [`Found ${finalMatches.length} matches`];

      let currentFile = "";
      for (const match of finalMatches) {
        if (currentFile !== match.path) {
          if (currentFile !== "") {
            outputLines.push("");
          }
          currentFile = match.path;
          outputLines.push(`${match.path}:`);
        }
        const truncatedLineText =
          match.lineText.length > this.maxLineLength 
            ? match.lineText.substring(0, this.maxLineLength) + "..." 
            : match.lineText;
        outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`);
      }

      if (truncated) {
        outputLines.push("");
        outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)");
      }

      return { content: outputLines.join("\n") };

    } catch (error) {
      throw new Error(String(error));
    }
  }

  /**
   * Search for files containing the pattern
   */
  private async searchFiles(
    dirPath: string,
    regex: RegExp,
    includePattern?: string
  ): Promise<Array<{ path: string; lineNum: number; lineText: string; modTime: number }>> {
    const results: Array<{ path: string; lineNum: number; lineText: string; modTime: number }> = [];
    
    await this.searchRecursive(dirPath, regex, includePattern, results);
    
    return results;
  }

  /**
   * Recursively search directories for pattern matches
   */
  private async searchRecursive(
    dirPath: string,
    regex: RegExp,
    includePattern: string | undefined,
    results: Array<{ path: string; lineNum: number; lineText: string; modTime: number }>
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that should be ignored
          if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
          }
          // Recursively search subdirectory
          await this.searchRecursive(entryPath, regex, includePattern, results);
        } else if (entry.isFile()) {
          // Check if file matches include pattern
          if (includePattern && !this.matchesIncludePattern(entry.name, includePattern)) {
            continue;
          }

          // Search file content
          const fileMatches = await this.searchFileContent(entryPath, regex);
          results.push(...fileMatches);
        }
      }
    } catch {
      // Skip directories we can't read
      return;
    }
  }

  /**
   * Search a single file for pattern matches
   */
  private async searchFileContent(
    filePath: string,
    regex: RegExp
  ): Promise<Array<{ path: string; lineNum: number; lineText: string; modTime: number }>> {
    try {
      // Get file modification time
      const stats = await this.fs.stat(filePath);
      const modTime = stats.mtimeMs || 0;

      // Read file content
      const content = await this.fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const matches: Array<{ path: string; lineNum: number; lineText: string; modTime: number }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Reset regex lastIndex for global regex
        regex.lastIndex = 0;
        
        if (regex.test(line)) {
          matches.push({
            path: filePath,
            lineNum: i + 1,
            lineText: line,
            modTime,
          });
        }
      }

      return matches;
    } catch {
      // Skip files we can't read (likely binary)
      return [];
    }
  }

  /**
   * Check if a filename matches the include pattern
   */
  private matchesIncludePattern(filename: string, includePattern: string): boolean {
    // Handle brace expansion like "*.{ts,tsx}"
    if (includePattern.includes('{') && includePattern.includes('}')) {
      const braceStart = includePattern.indexOf('{');
      const braceEnd = includePattern.indexOf('}');
      const prefix = includePattern.substring(0, braceStart);
      const suffix = includePattern.substring(braceEnd + 1);
      const options = includePattern.substring(braceStart + 1, braceEnd).split(',');

      return options.some(option => {
        const fullPattern = prefix + option + suffix;
        return this.matchesSimplePattern(filename, fullPattern);
      });
    }

    return this.matchesSimplePattern(filename, includePattern);
  }

  /**
   * Check if a filename matches a simple glob pattern
   */
  private matchesSimplePattern(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')      // Escape dots
      .replace(/\*/g, '.*')       // * matches anything
      .replace(/\?/g, '.');       // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filename);
  }
}
