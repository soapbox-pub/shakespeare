import { join, dirname } from "path-browserify";
import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { isAbsolutePath, isWriteAllowed, createWriteAccessDeniedError } from "../security";

interface WriteParams {
  content: string;
  filePath: string;
}

export class WriteTool implements Tool<WriteParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private projectsPath: string;
  private tmpPath: string;
  private onFileChanged?: (filePath: string) => void;

  readonly description = `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.`;

  readonly inputSchema = z.object({
    content: z.string().describe("The content to write to the file"),
    filePath: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
  });

  constructor(fs: JSRuntimeFS, cwd: string, options?: { projectsPath?: string; tmpPath?: string; onFileChanged?: (filePath: string) => void }) {
    this.fs = fs;
    this.cwd = cwd;
    this.projectsPath = options?.projectsPath || '/projects';
    this.tmpPath = options?.tmpPath || '/tmp';
    this.onFileChanged = options?.onFileChanged;
  }

  async execute(args: WriteParams): Promise<ToolResult> {
    let filepath = args.filePath;
    
    // Convert to absolute path if needed
    if (!isAbsolutePath(filepath)) {
      filepath = join(this.cwd, filepath);
    }

    // Check write permissions
    if (!isWriteAllowed(filepath, this.cwd, { projectsPath: this.projectsPath, tmpPath: this.tmpPath })) {
      throw new Error(createWriteAccessDeniedError(filepath, undefined, this.cwd, { projectsPath: this.projectsPath, tmpPath: this.tmpPath }));
    }

    // Ban direct writes to package.json
    if (
      filepath === "package.json" || 
      filepath.endsWith("/package.json") ||
      filepath.endsWith("\\package.json")
    ) {
      throw new Error(`🔒 Direct writes to package.json are disallowed.\n👉 Please use \`npm_add_package\` or \`npm_remove_package\` tools instead.`);
    }

    try {
      // Check if file exists
      const exists = await this.fs.stat(filepath).then(() => true).catch(() => false);

      // Create directory structure if needed
      await this.fs.mkdir(dirname(filepath), { recursive: true });

      // Write the file
      await this.fs.writeFile(filepath, args.content, "utf8");

      // Notify about file change (for auto-build)
      if (this.onFileChanged) {
        this.onFileChanged(filepath);
      }

      return { 
        content: exists 
          ? `File successfully written to ${filepath}` 
          : `File successfully created at ${filepath}`
      };
    } catch (error) {
      throw new Error(String(error));
    }
  }
}
