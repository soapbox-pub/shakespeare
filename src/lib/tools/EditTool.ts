// The approaches in this edit tool are sourced from OpenCode which credits:
// https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-23-25.ts
// https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/editCorrector.ts
// https://github.com/cline/cline/blob/main/evals/diff-edits/diff-apply/diff-06-26-25.ts

import { join } from "path-browserify";
import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { isAbsolutePath, isWriteAllowed, createWriteAccessDeniedError } from "../security";

interface EditParams {
  filePath: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

interface EditToolOptions {
  projectsPath?: string;
  tmpPath?: string;
  onFileChanged?: (filePath: string) => void;
  singleCandidateSimilarityThreshold?: number;
  multipleCandidatesSimilarityThreshold?: number;
}

export class EditTool implements Tool<EditParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private projectsPath: string;
  private tmpPath: string;
  private onFileChanged?: (filePath: string) => void;
  private singleCandidateSimilarityThreshold: number;
  private multipleCandidatesSimilarityThreshold: number;

  readonly description = `Performs exact string replacements in files. 

Usage:
- You must use your \`read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file. 
- When editing text from read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the oldString or newString.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`oldString\` is not found in the file with an error "oldString not found in content".
- The edit will FAIL if \`oldString\` is found multiple times in the file with an error "oldString found multiple times and requires more code context to uniquely identify the intended match". Either provide a larger string with more surrounding context to make it unique or use \`replaceAll\` to change every instance of \`oldString\`. 
- Use \`replaceAll\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`;

  readonly inputSchema = z.object({
    filePath: z.string().describe("The absolute path to the file to modify"),
    oldString: z.string().describe("The text to replace"),
    newString: z.string().describe("The text to replace it with (must be different from oldString)"),
    replaceAll: z.boolean().optional().describe("Replace all occurrences of oldString (default false)"),
  });

  constructor(fs: JSRuntimeFS, cwd: string, options?: EditToolOptions) {
    this.fs = fs;
    this.cwd = cwd;
    this.projectsPath = options?.projectsPath || '/projects';
    this.tmpPath = options?.tmpPath || '/tmp';
    this.onFileChanged = options?.onFileChanged;
    this.singleCandidateSimilarityThreshold = options?.singleCandidateSimilarityThreshold ?? 0.0;
    this.multipleCandidatesSimilarityThreshold = options?.multipleCandidatesSimilarityThreshold ?? 0.3;
  }

  async execute(args: EditParams): Promise<ToolResult> {
    if (!args.filePath) {
      throw new Error("filePath is required");
    }

    if (args.oldString === args.newString) {
      throw new Error("oldString and newString must be different");
    }

    let filepath = args.filePath;
    
    // Convert to absolute path if needed
    if (!isAbsolutePath(filepath)) {
      filepath = join(this.cwd, filepath);
    }

    // Check write permissions
    if (!isWriteAllowed(filepath, this.cwd, { projectsPath: this.projectsPath, tmpPath: this.tmpPath })) {
      throw new Error(createWriteAccessDeniedError(filepath, undefined, this.cwd, { projectsPath: this.projectsPath, tmpPath: this.tmpPath }));
    }

    // Ban editing dependencies in package.json
    if (
      filepath === "package.json" || 
      filepath.endsWith("/package.json") ||
      filepath.endsWith("\\package.json")
    ) {
      const depKeys = [
        '"dependencies"',
        '"devDependencies"',
        '"peerDependencies"',
        '"optionalDependencies"',
      ];
      if (
        depKeys.some((key) =>
          args.oldString.includes(key) || args.newString.includes(key)
        )
      ) {
        throw new Error(`🔒 Direct edits to dependencies in package.json are disallowed.\n👉 Please use npm_add_package or npm_remove_package tools for these changes.`);
      }
    }

    try {
      // Handle empty oldString as a special case (write new file)
      if (args.oldString === "") {
        await this.fs.writeFile(filepath, args.newString, "utf8");
        
        if (this.onFileChanged) {
          this.onFileChanged(filepath);
        }
        
        return { content: `File successfully created at ${filepath}` };
      }

      // Check if file exists
      const stats = await this.fs.stat(filepath).catch(() => null);
      if (!stats) {
        throw new Error(`File ${filepath} not found`);
      }
      if (stats.isDirectory()) {
        throw new Error(`Path is a directory, not a file: ${filepath}`);
      }

      // Read file content
      const contentOld = await this.fs.readFile(filepath, "utf8");
      
      // Perform replacement using fuzzy matching strategies
      const contentNew = this.replace(contentOld, args.oldString, args.newString, args.replaceAll);

      // Write updated content
      await this.fs.writeFile(filepath, contentNew, "utf8");

      // Notify about file change (for auto-build)
      if (this.onFileChanged) {
        this.onFileChanged(filepath);
      }

      return { content: `Edit applied successfully.` };

    } catch (error) {
      throw new Error(String(error));
    }
  }

  /**
   * Main replace function that tries multiple fuzzy matching strategies
   */
  private replace(content: string, oldString: string, newString: string, replaceAll = false): string {
    if (oldString === newString) {
      throw new Error("oldString and newString must be different");
    }

    let notFound = true;

    for (const replacer of [
      this.SimpleReplacer,
      this.LineTrimmedReplacer,
      this.BlockAnchorReplacer,
      this.WhitespaceNormalizedReplacer,
      this.IndentationFlexibleReplacer,
      this.EscapeNormalizedReplacer,
      this.TrimmedBoundaryReplacer,
      this.ContextAwareReplacer,
      this.MultiOccurrenceReplacer,
    ]) {
      for (const search of replacer.call(this, content, oldString)) {
        const index = content.indexOf(search);
        if (index === -1) continue;
        notFound = false;
        if (replaceAll) {
          return content.replaceAll(search, newString);
        }
        const lastIndex = content.lastIndexOf(search);
        if (index !== lastIndex) continue;
        return content.substring(0, index) + newString + content.substring(index + search.length);
      }
    }

    if (notFound) {
      throw new Error("oldString not found in content");
    }
    throw new Error(
      "oldString found multiple times and requires more code context to uniquely identify the intended match",
    );
  }

  private *SimpleReplacer(_content: string, find: string): Generator<string, void, unknown> {
    yield find;
  }

  private *LineTrimmedReplacer(content: string, find: string): Generator<string, void, unknown> {
    const originalLines = content.split("\n");
    const searchLines = find.split("\n");

    if (searchLines[searchLines.length - 1] === "") {
      searchLines.pop();
    }

    for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
      let matches = true;

      for (let j = 0; j < searchLines.length; j++) {
        const originalTrimmed = originalLines[i + j].trim();
        const searchTrimmed = searchLines[j].trim();

        if (originalTrimmed !== searchTrimmed) {
          matches = false;
          break;
        }
      }

      if (matches) {
        let matchStartIndex = 0;
        for (let k = 0; k < i; k++) {
          matchStartIndex += originalLines[k].length + 1;
        }

        let matchEndIndex = matchStartIndex;
        for (let k = 0; k < searchLines.length; k++) {
          matchEndIndex += originalLines[i + k].length;
          if (k < searchLines.length - 1) {
            matchEndIndex += 1; // Add newline character except for the last line
          }
        }

        yield content.substring(matchStartIndex, matchEndIndex);
      }
    }
  }

  private *BlockAnchorReplacer(content: string, find: string): Generator<string, void, unknown> {
    const originalLines = content.split("\n");
    const searchLines = find.split("\n");

    if (searchLines.length < 3) {
      return;
    }

    if (searchLines[searchLines.length - 1] === "") {
      searchLines.pop();
    }

    const firstLineSearch = searchLines[0].trim();
    const lastLineSearch = searchLines[searchLines.length - 1].trim();
    const searchBlockSize = searchLines.length;

    // Collect all candidate positions where both anchors match
    const candidates: Array<{ startLine: number; endLine: number }> = [];
    for (let i = 0; i < originalLines.length; i++) {
      if (originalLines[i].trim() !== firstLineSearch) {
        continue;
      }

      // Look for the matching last line after this first line
      for (let j = i + 2; j < originalLines.length; j++) {
        if (originalLines[j].trim() === lastLineSearch) {
          candidates.push({ startLine: i, endLine: j });
          break; // Only match the first occurrence of the last line
        }
      }
    }

    // Return immediately if no candidates
    if (candidates.length === 0) {
      return;
    }

    // Handle single candidate scenario (using relaxed threshold)
    if (candidates.length === 1) {
      const { startLine, endLine } = candidates[0];
      const actualBlockSize = endLine - startLine + 1;

      let similarity = 0;
      const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2); // Middle lines only

      if (linesToCheck > 0) {
        for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
          const originalLine = originalLines[startLine + j].trim();
          const searchLine = searchLines[j].trim();
          const maxLen = Math.max(originalLine.length, searchLine.length);
          if (maxLen === 0) {
            continue;
          }
          const distance = levenshtein(originalLine, searchLine);
          similarity += (1 - distance / maxLen) / linesToCheck;

          // Exit early when threshold is reached
          if (similarity >= this.singleCandidateSimilarityThreshold) {
            break;
          }
        }
      } else {
        // No middle lines to compare, just accept based on anchors
        similarity = 1.0;
      }

      if (similarity >= this.singleCandidateSimilarityThreshold) {
        let matchStartIndex = 0;
        for (let k = 0; k < startLine; k++) {
          matchStartIndex += originalLines[k].length + 1;
        }
        let matchEndIndex = matchStartIndex;
        for (let k = startLine; k <= endLine; k++) {
          matchEndIndex += originalLines[k].length;
          if (k < endLine) {
            matchEndIndex += 1; // Add newline character except for the last line
          }
        }
        yield content.substring(matchStartIndex, matchEndIndex);
      }
      return;
    }

    // Calculate similarity for multiple candidates
    let bestMatch: { startLine: number; endLine: number } | null = null;
    let maxSimilarity = -1;

    for (const candidate of candidates) {
      const { startLine, endLine } = candidate;
      const actualBlockSize = endLine - startLine + 1;

      let similarity = 0;
      const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2); // Middle lines only

      if (linesToCheck > 0) {
        for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
          const originalLine = originalLines[startLine + j].trim();
          const searchLine = searchLines[j].trim();
          const maxLen = Math.max(originalLine.length, searchLine.length);
          if (maxLen === 0) {
            continue;
          }
          const distance = levenshtein(originalLine, searchLine);
          similarity += 1 - distance / maxLen;
        }
        similarity /= linesToCheck; // Average similarity
      } else {
        // No middle lines to compare, just accept based on anchors
        similarity = 1.0;
      }

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = candidate;
      }
    }

    // Threshold judgment
    if (maxSimilarity >= this.multipleCandidatesSimilarityThreshold && bestMatch) {
      const { startLine, endLine } = bestMatch;
      let matchStartIndex = 0;
      for (let k = 0; k < startLine; k++) {
        matchStartIndex += originalLines[k].length + 1;
      }
      let matchEndIndex = matchStartIndex;
      for (let k = startLine; k <= endLine; k++) {
        matchEndIndex += originalLines[k].length;
        if (k < endLine) {
          matchEndIndex += 1;
        }
      }
      yield content.substring(matchStartIndex, matchEndIndex);
    }
  }

  private *WhitespaceNormalizedReplacer(content: string, find: string): Generator<string, void, unknown> {
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
    const normalizedFind = normalizeWhitespace(find);

    // Handle single line matches
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (normalizeWhitespace(line) === normalizedFind) {
        yield line;
      } else {
        // Only check for substring matches if the full line doesn't match
        const normalizedLine = normalizeWhitespace(line);
        if (normalizedLine.includes(normalizedFind)) {
          // Find the actual substring in the original line that matches
          const words = find.trim().split(/\s+/);
          if (words.length > 0) {
            const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
            try {
              const regex = new RegExp(pattern);
              const match = line.match(regex);
              if (match) {
                yield match[0];
              }
            } catch {
              // Invalid regex pattern, skip
            }
          }
        }
      }
    }

    // Handle multi-line matches
    const findLines = find.split("\n");
    if (findLines.length > 1) {
      for (let i = 0; i <= lines.length - findLines.length; i++) {
        const block = lines.slice(i, i + findLines.length);
        if (normalizeWhitespace(block.join("\n")) === normalizedFind) {
          yield block.join("\n");
        }
      }
    }
  }

  private *IndentationFlexibleReplacer(content: string, find: string): Generator<string, void, unknown> {
    const removeIndentation = (text: string) => {
      const lines = text.split("\n");
      const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
      if (nonEmptyLines.length === 0) return text;

      const minIndent = Math.min(
        ...nonEmptyLines.map((line) => {
          const match = line.match(/^(\s*)/);
          return match ? match[1].length : 0;
        }),
      );

      return lines.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent))).join("\n");
    };

    const normalizedFind = removeIndentation(find);
    const contentLines = content.split("\n");
    const findLines = find.split("\n");

    for (let i = 0; i <= contentLines.length - findLines.length; i++) {
      const block = contentLines.slice(i, i + findLines.length).join("\n");
      if (removeIndentation(block) === normalizedFind) {
        yield block;
      }
    }
  }

  private *EscapeNormalizedReplacer(content: string, find: string): Generator<string, void, unknown> {
    const unescapeString = (str: string): string => {
      return str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, capturedChar) => {
        switch (capturedChar) {
          case "n":
            return "\n";
          case "t":
            return "\t";
          case "r":
            return "\r";
          case "'":
            return "'";
          case '"':
            return '"';
          case "`":
            return "`";
          case "\\":
            return "\\";
          case "\n":
            return "\n";
          case "$":
            return "$";
          default:
            return match;
        }
      });
    };

    const unescapedFind = unescapeString(find);

    // Try direct match with unescaped find string
    if (content.includes(unescapedFind)) {
      yield unescapedFind;
    }

    // Also try finding escaped versions in content that match unescaped find
    const lines = content.split("\n");
    const findLines = unescapedFind.split("\n");

    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length).join("\n");
      const unescapedBlock = unescapeString(block);

      if (unescapedBlock === unescapedFind) {
        yield block;
      }
    }
  }

  private *MultiOccurrenceReplacer(content: string, find: string): Generator<string, void, unknown> {
    // This replacer yields all exact matches, allowing the replace function
    // to handle multiple occurrences based on replaceAll parameter
    let startIndex = 0;

    while (true) {
      const index = content.indexOf(find, startIndex);
      if (index === -1) break;

      yield find;
      startIndex = index + find.length;
    }
  }

  private *TrimmedBoundaryReplacer(content: string, find: string): Generator<string, void, unknown> {
    const trimmedFind = find.trim();

    if (trimmedFind === find) {
      // Already trimmed, no point in trying
      return;
    }

    // Try to find the trimmed version
    if (content.includes(trimmedFind)) {
      yield trimmedFind;
    }

    // Also try finding blocks where trimmed content matches
    const lines = content.split("\n");
    const findLines = find.split("\n");

    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length).join("\n");

      if (block.trim() === trimmedFind) {
        yield block;
      }
    }
  }

  private *ContextAwareReplacer(content: string, find: string): Generator<string, void, unknown> {
    const findLines = find.split("\n");
    if (findLines.length < 3) {
      // Need at least 3 lines to have meaningful context
      return;
    }

    // Remove trailing empty line if present
    if (findLines[findLines.length - 1] === "") {
      findLines.pop();
    }

    const contentLines = content.split("\n");

    // Extract first and last lines as context anchors
    const firstLine = findLines[0].trim();
    const lastLine = findLines[findLines.length - 1].trim();

    // Find blocks that start and end with the context anchors
    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].trim() !== firstLine) continue;

      // Look for the matching last line
      for (let j = i + 2; j < contentLines.length; j++) {
        if (contentLines[j].trim() === lastLine) {
          // Found a potential context block
          const blockLines = contentLines.slice(i, j + 1);
          const block = blockLines.join("\n");

          // Check if the middle content has reasonable similarity
          // (simple heuristic: at least 50% of non-empty lines should match when trimmed)
          if (blockLines.length === findLines.length) {
            let matchingLines = 0;
            let totalNonEmptyLines = 0;

            for (let k = 1; k < blockLines.length - 1; k++) {
              const blockLine = blockLines[k].trim();
              const findLine = findLines[k].trim();

              if (blockLine.length > 0 || findLine.length > 0) {
                totalNonEmptyLines++;
                if (blockLine === findLine) {
                  matchingLines++;
                }
              }
            }

            if (totalNonEmptyLines === 0 || matchingLines / totalNonEmptyLines >= 0.5) {
              yield block;
              break; // Only match the first occurrence
            }
          }
          break;
        }
      }
    }
  }
}

/**
 * Levenshtein distance algorithm implementation
 */
function levenshtein(a: string, b: string): number {
  // Handle empty strings
  if (a === "" || b === "") {
    return Math.max(a.length, b.length);
  }
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}
