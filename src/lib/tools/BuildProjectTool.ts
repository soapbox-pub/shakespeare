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
      // Check if we're in a valid project directory
      try {
        await this.fs.readFile(`${this.cwd}/package.json`, "utf8");
      } catch {
        throw new Error(`❌ Could not find package.json at ${this.cwd}. Make sure you're in a valid project directory.`);
      }

      // Check if index.html exists
      try {
        await this.fs.readFile(`${this.cwd}/index.html`, "utf8");
      } catch {
        throw new Error(`❌ Could not find index.html at ${this.cwd}. This is required for building the project.`);
      }

      // Run the build
      const dist = await buildProject({
        fs: this.fs,
        projectPath: this.cwd,
        domParser: new DOMParser(),
      });

      // Delete all existing files in "dist" directory
      try {
        const distFiles = await this.fs.readdir(`${this.cwd}/dist`);
        for (const file of distFiles) {
          await this.fs.unlink(`${this.cwd}/dist/${file}`);
        }
      } catch {
        // Ignore errors (e.g., directory doesn't exist)
      }

      // Create dist directory if it doesn't exist
      await this.fs.mkdir(`${this.cwd}/dist`, { recursive: true });

      // Write all built files to dist directory
      for (const [path, contents] of Object.entries(dist)) {
        await this.fs.writeFile(`${this.cwd}/dist/${path}`, contents);
      }

      const fileCount = Object.keys(dist).length;
      const fileList = Object.keys(dist).map(file => `  📄 ${file}`).join('\n');

      return `✅ Successfully built project!\n\n📁 Output: ${this.cwd}/dist\n📦 Files generated: ${fileCount}\n\n${fileList}\n\n🚀 Your project is ready for deployment!`;
    } catch (error) {
      throw new Error(`❌ Build failed: ${String(error)}`);
    }
  }
}