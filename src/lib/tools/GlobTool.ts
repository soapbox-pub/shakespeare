import { join } from "path-browserify";
import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface GlobParams {
  pattern: string;
  path?: string;
}

interface GlobToolOptions {
  resultLimit?: number;
}

export class GlobTool implements Tool<GlobParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private resultLimit: number;

  readonly description = `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open-ended search that may require multiple rounds of globbing and grepping, use the Task tool instead
- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.`;

  readonly inputSchema = z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe(
        `The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.`,
      ),
  });

  constructor(fs: JSRuntimeFS, cwd: string, options?: GlobToolOptions) {
    this.fs = fs;
    this.cwd = cwd;
    this.resultLimit = options?.resultLimit || 100;
  }

  async execute(args: GlobParams): Promise<ToolResult> {
    try {
      // Determine the search path and pattern
      // If args.path is provided, use it as the base directory
      // Otherwise, extract any leading directory path from the pattern itself
      let searchPath: string;
      let pattern: string;

      if (args.path) {
        // User explicitly specified a path parameter
        searchPath = join(this.cwd, args.path);
        pattern = args.pattern;
      } else {
        // Parse the pattern to extract base directory
        const parsed = this.parsePatternPath(args.pattern);
        searchPath = parsed.basePath ? join(this.cwd, parsed.basePath) : this.cwd;
        pattern = parsed.globPattern;
      }

      // Check if search path exists
      const stats = await this.fs.stat(searchPath);
      if (!stats.isDirectory()) {
        throw new Error(`Not a directory: ${searchPath}`);
      }

      // Perform the search
      const files = await this.searchFiles(searchPath, pattern);

      // Sort by modification time (most recent first)
      files.sort((a, b) => b.mtime - a.mtime);

      // Truncate results if needed
      const truncated = files.length > this.resultLimit;
      const finalFiles = truncated ? files.slice(0, this.resultLimit) : files;

      // Format output
      const output: string[] = [];
      if (finalFiles.length === 0) {
        output.push("No files found");
      } else {
        output.push(...finalFiles.map((f) => f.path));
        if (truncated) {
          output.push("");
          output.push("(Results are truncated. Consider using a more specific path or pattern.)");
        }
      }

      return { content: output.join("\n") };

    } catch (error) {
      throw new Error(String(error));
    }
  }

  private parsePatternPath(pattern: string): { basePath: string; globPattern: string } {
    const segments = pattern.split('/');
    
    // Find the first segment that contains glob characters
    const firstGlobIndex = segments.findIndex(seg => 
      seg.includes('*') || seg.includes('?') || seg.includes('[')
    );

    if (firstGlobIndex === -1) {
      // No glob characters found - treat entire pattern as base path
      return { basePath: pattern, globPattern: '**/*' };
    }

    if (firstGlobIndex === 0) {
      // Pattern starts with glob - no base path
      return { basePath: '', globPattern: pattern };
    }

    // Split into base path and glob pattern
    const basePath = segments.slice(0, firstGlobIndex).join('/');
    const globPattern = segments.slice(firstGlobIndex).join('/');

    return { basePath, globPattern };
  }

  private async searchFiles(
    dirPath: string,
    pattern: string
  ): Promise<Array<{ path: string; mtime: number }>> {
    const results: Array<{ path: string; mtime: number }> = [];
    
    // Parse the glob pattern into segments
    const segments = pattern.split('/');
    
    await this.searchRecursive(dirPath, dirPath, segments, 0, results);
    
    return results;
  }

  private async searchRecursive(
    basePath: string,
    currentPath: string,
    segments: string[],
    segmentIndex: number,
    results: Array<{ path: string; mtime: number }>
  ): Promise<void> {
    // If we've matched all segments, we're done
    if (segmentIndex >= segments.length) {
      return;
    }

    const segment = segments[segmentIndex];

    try {
      const entries = await this.fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(currentPath, entry.name);

        // Handle ** (recursive wildcard)
        if (segment === '**') {
          // ** can match zero or more directories
          if (entry.isDirectory()) {
            // Continue matching with ** at current level
            await this.searchRecursive(basePath, entryPath, segments, segmentIndex, results);
          }
          
          // Try matching the next segment
          if (segmentIndex + 1 < segments.length) {
            if (this.matchesPattern(entry.name, segments[segmentIndex + 1])) {
              if (segmentIndex + 2 === segments.length) {
                // This is the final match
                if (entry.isFile()) {
                  const stats = await this.fs.stat(entryPath);
                  const mtime = stats.mtimeMs || 0;
                  results.push({ path: entryPath, mtime });
                }
              } else {
                // Continue matching subsequent segments
                if (entry.isDirectory()) {
                  await this.searchRecursive(basePath, entryPath, segments, segmentIndex + 2, results);
                }
              }
            }
          }
        } else if (this.matchesPattern(entry.name, segment)) {
          // Regular segment match
          if (segmentIndex === segments.length - 1) {
            // This is the final segment - add matching files
            if (entry.isFile()) {
              const stats = await this.fs.stat(entryPath);
              const mtime = stats.mtimeMs || 0;
              results.push({ path: entryPath, mtime });
            }
          } else {
            // More segments to match - continue into directories
            if (entry.isDirectory()) {
              await this.searchRecursive(basePath, entryPath, segments, segmentIndex + 1, results);
            }
          }
        }
      }
    } catch {
      // Skip directories we can't read
      return;
    }
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '\u00A7\u00A7\u00A7')
      .replace(/\*/g, '[^/]*')
      .replace(/\u00A7\u00A7\u00A7/g, '.*')
      .replace(/\?/g, '[^/]');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filename);
  }
}
