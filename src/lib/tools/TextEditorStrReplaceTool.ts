import { join } from "@std/path";
import { z } from "zod";

import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { isAbsolutePath, isWriteAllowed, createWriteAccessDeniedError } from "../security";

interface TextEditorStrReplaceParams {
  path: string;
  old_str: string;
  new_str: string;
  normalize_whitespace?: boolean;
}

export class TextEditorStrReplaceTool implements Tool<TextEditorStrReplaceParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Replace a string in a file with a new string";

  readonly inputSchema = z.object({
    path: z.string().describe('Path to the file, eg "src/index.ts"'),
    old_str: z.string().describe("The string to replace"),
    new_str: z.string().describe("The new string to insert"),
    normalize_whitespace: z.boolean().optional().describe(
      "If true, normalize whitespace and line endings for more flexible matching (default: true)"
    ),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: TextEditorStrReplaceParams): Promise<string> {
    const { path, old_str, new_str, normalize_whitespace = true } = args;

    // Check write permissions
    if (!isWriteAllowed(path, this.cwd)) {
      throw new Error(createWriteAccessDeniedError(path, undefined, this.cwd));
    }

    // Ban editing dependencies in package.json
    if (
      path === "package.json" || path.endsWith("/package.json") ||
      path.endsWith("\\package.json")
    ) {
      const depKeys = [
        '"dependencies"',
        '"devDependencies"',
        '"peerDependencies"',
        '"optionalDependencies"',
      ];
      if (
        depKeys.some((key) =>
          old_str.includes(key) || new_str.includes(key)
        )
      ) {
        throw new Error(`🔒 Direct edits to dependencies in package.json are disallowed.\n👉 Please use npm_add_package or npm_remove_package tools for these changes.`);
      }
    }

    try {
      // Handle both absolute and relative paths
      let absolutePath: string;
      if (isAbsolutePath(path)) {
        absolutePath = path;
      } else {
        absolutePath = join(this.cwd, path);
      }

      const content = await this.fs.readFile(absolutePath, "utf8");

      // Helper function to normalize whitespace
      const normalizeWhitespace = (str: string): string => {
        return str
          .replace(/\r\n/g, '\n')  // Convert CRLF to LF
          .replace(/\r/g, '\n')    // Convert CR to LF
          .split('\n')
          .map(line => line.trimEnd())  // Remove trailing whitespace from each line
          .join('\n');
      };

      let searchContent = content;
      let searchOldStr = old_str;
      let searchNewStr = new_str;

      if (normalize_whitespace) {
        searchContent = normalizeWhitespace(content);
        searchOldStr = normalizeWhitespace(old_str);
        searchNewStr = normalizeWhitespace(new_str);
      }

      if (!searchContent.includes(searchOldStr)) {
        // Try to provide helpful debugging information
        const lines = searchContent.split('\n');
        const oldLines = searchOldStr.split('\n');

        // Find potential matches by looking for the first line of old_str
        const firstLine = oldLines[0];
        const matchingLineNumbers: number[] = [];

        if (firstLine) {
          lines.forEach((line, index) => {
            if (line.includes(firstLine)) {
              matchingLineNumbers.push(index + 1);
            }
          });
        }

        let errorMessage = `Error: The string to replace was not found in ${path}`;

        if (matchingLineNumbers.length > 0) {
          errorMessage += `\n\nPossible matches found at lines: ${matchingLineNumbers.join(', ')}`;

          // Show context around the first potential match
          const firstMatch = matchingLineNumbers[0]! - 1;
          const contextStart = Math.max(0, firstMatch - 2);
          const contextEnd = Math.min(lines.length, firstMatch + oldLines.length + 2);
          const contextLines = lines.slice(contextStart, contextEnd);

          errorMessage += `\n\nContext around line ${matchingLineNumbers[0]}:`;
          contextLines.forEach((line, index) => {
            const lineNum = contextStart + index + 1;
            const marker = lineNum === matchingLineNumbers[0] ? '→ ' : '  ';
            errorMessage += `\n${marker}${lineNum}: ${line}`;
          });
        }

        if (normalize_whitespace) {
          errorMessage += `\n\nNote: Whitespace normalization was applied. Try setting normalize_whitespace to false if the replacement still fails.`;
        }

        throw new Error(errorMessage);
      }

      // Count occurrences (simple string counting)
      let occurrences = 0;
      let pos = 0;
      while ((pos = searchContent.indexOf(searchOldStr, pos)) !== -1) {
        occurrences++;
        pos += searchOldStr.length;
      }

      // Perform the replacement
      let newContent: string;
      if (normalize_whitespace) {
        // Apply the replacement to the normalized content, then restore original line endings
        const normalizedResult = searchContent.replace(searchOldStr, searchNewStr);

        // Try to preserve the original line ending style
        const hasCarriageReturn = content.includes('\r');
        if (hasCarriageReturn) {
          if (content.includes('\r\n')) {
            // Original had CRLF
            newContent = normalizedResult.replace(/\n/g, '\r\n');
          } else {
            // Original had CR only
            newContent = normalizedResult.replace(/\n/g, '\r');
          }
        } else {
          // Original had LF only
          newContent = normalizedResult;
        }
      } else {
        newContent = content.replace(old_str, new_str);
      }

      await this.fs.writeFile(absolutePath, newContent, "utf8");

      let successMessage = `String successfully replaced in ${path}`;
      if (occurrences > 1) {
        successMessage += ` (${occurrences} occurrences found, only first occurrence replaced)`;
      }

      return successMessage;
    } catch (error) {
      throw new Error(String(error));
    }
  }
}