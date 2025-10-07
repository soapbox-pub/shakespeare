import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { buildProject } from "../build";

export class BuildProjectTool implements Tool<void> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Build the project using esbuild. Creates optimized production files in the dist directory.";

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(): Promise<string> {
    try {
      // Build and write the project files
      const result = await buildProject({
        esmUrl: 'https://esm.shakespeare.diy',
        fs: this.fs,
        projectPath: this.cwd,
        domParser: new DOMParser(),
      });

      const fileCount = Object.keys(result.files).length;
      const fileList = Object.keys(result.files).map(file => `  📄 ${file}`).join('\n');

      return `✅ Successfully built project!\n\n📁 Output: ${result.outputPath}\n📦 Files generated: ${fileCount}\n\n${fileList}\n\n🚀 Your project is ready for deployment!`;
    } catch (error) {
      throw new Error(`❌ Build failed: ${String(error)}`);
    }
  }
}