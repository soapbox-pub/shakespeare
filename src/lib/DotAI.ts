import { join } from "@std/path";
import type OpenAI from "openai";
import type { JSRuntimeFS } from "./JSRuntime";

/** AI message history manager and .ai directory utilities */
export class DotAI {
  private readonly fs: JSRuntimeFS;
  private readonly historyDir: string;
  private readonly workingDir: string;

  constructor(fs: JSRuntimeFS, workingDir: string = "/") {
    this.fs = fs;
    this.workingDir = workingDir;
    this.historyDir = join(workingDir, ".ai", "history");
  }

  /** Generate a unique session name based on the current date and time */
  static generateSessionName(): string {
    // Generate filename with date, time in milliseconds, and random value
    const now = new Date();
    const dateString = now.toISOString();

    // Generate a random 3-character suffix to avoid collisions
    const randomSuffix = Math.random().toString(36).substring(2, 5);

    // Format: YYYY-MM-DDTHH-MM-SSZ-suffix.jsonl
    const filename = `${
      dateString.replace(/:/g, "-").slice(0, dateString.indexOf("."))
    }Z-${randomSuffix}`;

    return filename;
  }

  /** Check if AI history should be enabled based on the new criteria */
  async isEnabled(): Promise<boolean> {
    // Check if .ai directory exists
    try {
      const stat = await this.fs.stat(join(this.workingDir, ".ai"));
      if (stat.isDirectory()) {
        return true;
      }
    } catch {
      // Continue to next check
    }

    // Check if .ai/ or .ai is gitignored
    try {
      const gitignorePath = join(this.workingDir, ".gitignore");
      const gitignoreContent = await this.fs.readFile(gitignorePath, "utf8");
      const lines = gitignoreContent.split("\n").map((line) => line.trim());

      // Check for .ai/ or .ai patterns (ignore comments and empty lines)
      for (const line of lines) {
        if (line.startsWith("#") || line === "") {
          continue;
        }

        // Check for various .ai patterns
        if (
          line === ".ai" || line === ".ai/" || line === "/.ai" ||
          line === "/.ai/" ||
          line === ".ai/*" || line === "/.ai/*"
        ) {
          return true;
        }
      }
    } catch {
      // .gitignore doesn't exist or can't be read
    }

    return false;
  }

  /** Check if the history directory exists */
  async historyDirExists(): Promise<boolean> {
    try {
      const stat = await this.fs.stat(this.historyDir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /** Save a message to the history file */
  async addToHistory(
    sessionName: string,
    message: OpenAI.Chat.Completions.ChatCompletionMessageParam,
  ): Promise<void> {
    // Only save if history should be enabled based on the new criteria
    if (!(await this.isEnabled())) {
      return;
    }

    // Create the history directory if it doesn't exist
    if (!(await this.historyDirExists())) {
      await this.setupAiHistoryDir();
    }

    const jsonLine = JSON.stringify(message) + "\n";
    const sessionFile = join(this.historyDir, sessionName + ".jsonl");

    try {
      // JSRuntimeFS doesn't have appendFile, so we read, append, and write
      let existingContent = "";
      try {
        existingContent = await this.fs.readFile(sessionFile, "utf8");
      } catch {
        // File doesn't exist yet, that's fine
      }
      await this.fs.writeFile(sessionFile, existingContent + jsonLine);
    } catch (error) {
      // Log error but don't fail the main operation
      console.warn(`Failed to save message to AI history: ${error}`);
    }
  }

  /**
   * Creates .ai/history directory and ensures .ai/ is gitignored at the project root.
   */
  async setupAiHistoryDir(): Promise<void> {
    const aiHistoryDir = join(this.workingDir, ".ai", "history");

    try {
      // Create .ai/history directory
      await this.fs.mkdir(aiHistoryDir, { recursive: true });

      // Ensure .ai/ is gitignored at the project root
      await this.ensureAiGitignored();
    } catch (error) {
      // Log error but don't fail the main operation
      console.warn(`Failed to setup .ai/history directory: ${error}`);
    }
  }

  /**
   * Read the model from .ai/MODEL file
   */
  async readAiModel(): Promise<string | undefined> {
    try {
      const modelPath = join(this.workingDir, ".ai", "MODEL");
      const content = await this.fs.readFile(modelPath, "utf8");
      return content.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Write the model to .ai/MODEL file
   */
  async writeAiModel(model: string): Promise<void> {
    const aiDir = join(this.workingDir, ".ai");
    const modelPath = join(aiDir, "MODEL");

    try {
      // Ensure .ai directory exists
      await this.fs.mkdir(aiDir, { recursive: true });

      // Write the model
      await this.fs.writeFile(modelPath, model.trim() + "\n");
    } catch (error) {
      console.warn(`Failed to write .ai/MODEL file: ${error}`);
    }
  }

  /**
   * Read parameters from .ai/PARAMETERS file
   */
  async readAiParameters(): Promise<Record<string, string>> {
    try {
      const parametersPath = join(this.workingDir, ".ai", "PARAMETERS");
      const content = await this.fs.readFile(parametersPath, "utf8");

      const parameters: Record<string, string> = {};
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith("#")) {
          const equalIndex = trimmedLine.indexOf("=");
          if (equalIndex > 0) {
            const key = trimmedLine.substring(0, equalIndex).trim();
            const value = trimmedLine.substring(equalIndex + 1).trim();
            parameters[key] = value;
          }
        }
      }

      return parameters;
    } catch {
      return {};
    }
  }

  /**
   * Write parameters to .ai/PARAMETERS file
   */
  async writeAiParameters(parameters: Record<string, string>): Promise<void> {
    // Check if we should create the .ai directory based on the same logic as MODEL
    const shouldCreate = await this.isEnabled();

    if (!shouldCreate) {
      return;
    }

    const aiDir = join(this.workingDir, ".ai");
    const parametersPath = join(aiDir, "PARAMETERS");

    try {
      // Ensure .ai directory exists
      await this.fs.mkdir(aiDir, { recursive: true });

      // Format parameters as key=value pairs
      const lines = Object.entries(parameters).map(([key, value]) =>
        `${key}=${value}`
      );
      const content = lines.join("\n") + (lines.length > 0 ? "\n" : "");

      // Write the parameters
      await this.fs.writeFile(parametersPath, content);
    } catch (error) {
      console.warn(`Failed to write .ai/PARAMETERS file: ${error}`);
    }
  }

  /**
   * Update a single parameter in .ai/PARAMETERS file
   */
  async updateAiParameter(key: string, value: string): Promise<void> {
    const currentParameters = await this.readAiParameters();
    currentParameters[key] = value;
    await this.writeAiParameters(currentParameters);
  }

  /**
   * Ensures that .ai/ is gitignored at the project root level.
   * Creates a .gitignore file if it doesn't exist, or adds the line if not already present.
   */
  async ensureAiGitignored(): Promise<void> {
    const gitignorePath = join(this.workingDir, ".gitignore");
    const aiPattern = ".ai/";

    try {
      // Try to read existing .gitignore
      let gitignoreContent = "";
      try {
        gitignoreContent = await this.fs.readFile(gitignorePath, "utf8");
      } catch {
        // .gitignore doesn't exist, will create it
      }

      // Check if .ai/ is already gitignored
      const lines = gitignoreContent.split("\n").map((line) => line.trim());
      const hasAiPattern = lines.some((line) => {
        if (line.startsWith("#") || line === "") {
          return false;
        }
        // Check for various .ai patterns
        return line === ".ai" || line === ".ai/" || line === "/.ai" ||
          line === "/.ai/" ||
          line === ".ai/*" || line === "/.ai/*";
      });

      if (!hasAiPattern) {
        // Add .ai/ to .gitignore
        const newContent = gitignoreContent.trim() === ""
          ? aiPattern
          : gitignoreContent.trim() + "\n" + aiPattern;

        await this.fs.writeFile(gitignorePath, newContent + "\n");
      }
    } catch (error) {
      // Log error but don't fail the main operation
      console.warn(`Failed to ensure .ai/ is gitignored: ${error}`);
    }
  }
}
