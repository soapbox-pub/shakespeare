import { join, dirname } from "@std/path";
import { z } from "zod";

import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface TextEditorWriteParams {
  path: string;
  file_text: string;
}

export class TextEditorWriteTool implements Tool<TextEditorWriteParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Create or overwrite a file with new content";

  readonly inputSchema = z.object({
    path: z.string().describe(
      'Path of the file to write, eg "src/index.ts"',
    ),
    file_text: z.string().describe("Content to write to the file"),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: TextEditorWriteParams): Promise<string> {
    const { path, file_text } = args;

    // Check for absolute paths and provide helpful error
    if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) {
      throw new Error(`❌ Absolute paths are not supported.\n\nThe path "${path}" appears to be an absolute path.\n\n💡 Please use a relative path instead. Examples:\n- "src/index.ts" (relative to current directory)\n- "./src/index.ts" (explicit relative path)\n- "../other-project/src/index.ts" (relative to parent directory)\n\nCurrent working directory: ${this.cwd}`);
    }

    if (
      path === "package.json" || path.endsWith("/package.json") ||
      path.endsWith("\\package.json")
    ) {
      throw new Error(`🔒 Direct writes to package.json are disallowed.\n👉 Please use \`npm_add_package\` or \`npm_remove_package\` tools instead.`);
    }

    try {
      const absolutePath = join(this.cwd, path);
      await this.fs.mkdir(dirname(absolutePath), { recursive: true });
      await this.fs.writeFile(absolutePath, file_text, "utf8");
      return `File successfully written to ${path}`;
    } catch (error) {
      throw new Error(String(error));
    }
  }
}