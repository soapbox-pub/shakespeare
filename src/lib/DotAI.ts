import { join } from "path-browserify";
import type OpenAI from "openai";
import type { JSRuntimeFS } from "./JSRuntime";
import { isEmptyMessage } from "./isEmptyMessage";

/** AI message history manager and .git/ai directory utilities */
export class DotAI {
  readonly fs: JSRuntimeFS;
  readonly historyDir: string;
  readonly workingDir: string;

  constructor(fs: JSRuntimeFS, workingDir: string = "/") {
    this.fs = fs;
    this.workingDir = workingDir;
    this.historyDir = join(workingDir, ".git", "ai", "history");
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

  /** Check if the history directory exists */
  async historyDirExists(): Promise<boolean> {
    try {
      const stat = await this.fs.stat(this.historyDir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /** Save the full message history to the history file */
  async setHistory(
    sessionName: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): Promise<void> {
    // Filter out empty assistant messages
    messages = messages.filter((msg) => !isEmptyMessage(msg));

    // Validate messages before saving
    this.validateMessages(messages);

    // Create the history directory if it doesn't exist
    if (!(await this.historyDirExists())) {
      await this.fs.mkdir(this.historyDir, { recursive: true });
    }

    const sessionFile = join(this.historyDir, sessionName + ".jsonl");

    try {
      // Convert messages to JSONL format
      const jsonlContent = messages.map(message => JSON.stringify(message)).join('\n');
      const finalContent = jsonlContent + (messages.length > 0 ? '\n' : '');

      // Write the entire file
      await this.fs.writeFile(sessionFile, finalContent);
    } catch (error) {
      // Log error but don't fail the main operation
      console.warn(`Failed to save messages to AI history: ${error}`);
    }
  }

  /** Validate that tool messages are properly preceded by assistant messages with matching tool calls */
  private validateMessages(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): void {
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // Check if this is a tool message
      if (message.role === 'tool') {
        // Tool messages must have tool_call_id
        if (!('tool_call_id' in message) || !message.tool_call_id) {
          throw new Error(`Tool message at index ${i} is missing tool_call_id`);
        }

        // Find the preceding assistant message with tool calls
        let foundMatchingToolCall = false;

        // Look backwards from the current position to find the assistant message with matching tool call
        for (let j = i - 1; j >= 0; j--) {
          const prevMessage = messages[j];

          if (prevMessage.role === 'assistant') {
            // Check if this assistant message has tool_calls
            if ('tool_calls' in prevMessage && prevMessage.tool_calls) {
              // Check if any tool call ID matches
              const hasMatchingId = prevMessage.tool_calls.some(
                toolCall => toolCall.id === message.tool_call_id
              );

              if (hasMatchingId) {
                foundMatchingToolCall = true;
                break;
              }
            }

            // If we found an assistant message without the matching tool call, stop looking
            // (tool messages should be paired with the most recent assistant message with tool calls)
            break;
          }
        }

        if (!foundMatchingToolCall) {
          throw new Error(
            `Tool message at index ${i} with tool_call_id "${message.tool_call_id}" ` +
            `must be preceded by an assistant message with a matching tool_call id`
          );
        }
      }
    }
  }

  /**
   * Read the model from .git/ai/MODEL file
   */
  async readAiModel(): Promise<string | undefined> {
    try {
      const modelPath = join(this.workingDir, ".git", "ai", "MODEL");
      const content = await this.fs.readFile(modelPath, "utf8");
      return content.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Write the model to .git/ai/MODEL file
   */
  async writeAiModel(model: string): Promise<void> {
    const aiDir = join(this.workingDir, ".git", "ai");
    const modelPath = join(aiDir, "MODEL");

    try {
      // Ensure .git/ai directory exists
      await this.fs.mkdir(aiDir, { recursive: true });

      // Write the model
      await this.fs.writeFile(modelPath, model.trim() + "\n");
    } catch (error) {
      console.warn(`Failed to write .git/ai/MODEL file: ${error}`);
    }
  }

  /**
   * Read parameters from .git/ai/PARAMETERS file
   */
  async readAiParameters(): Promise<Record<string, string>> {
    try {
      const parametersPath = join(this.workingDir, ".git", "ai", "PARAMETERS");
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
   * Write parameters to .git/ai/PARAMETERS file
   */
  async writeAiParameters(parameters: Record<string, string>): Promise<void> {
    const aiDir = join(this.workingDir, ".git", "ai");
    const parametersPath = join(aiDir, "PARAMETERS");

    try {
      // Ensure .git/ai directory exists
      await this.fs.mkdir(aiDir, { recursive: true });

      // Format parameters as key=value pairs
      const lines = Object.entries(parameters).map(([key, value]) =>
        `${key}=${value}`
      );
      const content = lines.join("\n") + (lines.length > 0 ? "\n" : "");

      // Write the parameters
      await this.fs.writeFile(parametersPath, content);
    } catch (error) {
      console.warn(`Failed to write .git/ai/PARAMETERS file: ${error}`);
    }
  }

  /**
   * Update a single parameter in .git/ai/PARAMETERS file
   */
  async updateAiParameter(key: string, value: string): Promise<void> {
    const currentParameters = await this.readAiParameters();
    currentParameters[key] = value;
    await this.writeAiParameters(currentParameters);
  }

  /**
   * Parse timestamp from session name (format: YYYY-MM-DDTHH-MM-SSZ-suffix)
   */
  static parseSessionTimestamp(sessionName: string): Date {
    // Session name format: 2024-01-10T12-30-45Z-abc
    // Need to convert back to ISO format: 2024-01-10T12:30:45Z
    const match = sessionName.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/);
    if (match) {
      const [, date, hour, min, sec] = match;
      return new Date(`${date}T${hour}:${min}:${sec}Z`);
    }
    // Fallback to current time if parsing fails
    return new Date();
  }

  /**
   * Read all session histories sorted chronologically
   * @returns Array of session histories with messages and timestamps
   */
  async readAllSessionHistories(): Promise<Array<{
    sessionName: string;
    timestamp: Date;
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  }>> {
    const sessions: Array<{
      sessionName: string;
      timestamp: Date;
      messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    }> = [];

    try {
      if (!(await this.historyDirExists())) {
        return sessions;
      }

      const files = await this.fs.readdir(this.historyDir);
      const sessionFiles = files
        .filter(file => file.endsWith('.jsonl'))
        .sort(); // Chronological order (oldest first)

      for (const file of sessionFiles) {
        const sessionPath = join(this.historyDir, file);
        const sessionName = file.replace('.jsonl', '');

        try {
          const content = await this.fs.readFile(sessionPath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

          for (const line of lines) {
            try {
              const message = JSON.parse(line) as OpenAI.Chat.Completions.ChatCompletionMessageParam;
              messages.push(message);
            } catch {
              // Skip malformed lines
            }
          }

          // Only include sessions with messages
          if (messages.length > 0) {
            sessions.push({
              sessionName,
              timestamp: DotAI.parseSessionTimestamp(sessionName),
              messages,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch (error) {
      console.warn('Failed to read all session histories:', error);
    }

    return sessions;
  }

  /**
   * Read the most recent session history
   * @returns Object containing messages array and session name, or null if no history found
   */
  async readLastSessionHistory(): Promise<{
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    sessionName: string;
  } | null> {
    try {
      // Check if history directory exists
      if (!(await this.historyDirExists())) {
        return null;
      }

      // Find the most recent session file
      try {
        const files = await this.fs.readdir(this.historyDir);
        const sessionFiles = files
          .filter(file => file.endsWith('.jsonl'))
          .sort()
          .reverse(); // Most recent first

        if (sessionFiles.length === 0) {
          return null;
        }

        const latestSessionFile = sessionFiles[0];
        const sessionPath = join(this.historyDir, latestSessionFile);

        try {
          const content = await this.fs.readFile(sessionPath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

          for (const line of lines) {
            try {
              const message = JSON.parse(line) as OpenAI.Chat.Completions.ChatCompletionMessageParam;
              messages.push(message);
            } catch (parseError) {
              console.warn('Failed to parse message from history:', parseError);
            }
          }

          // Return session name without .jsonl extension
          const sessionName = latestSessionFile.replace('.jsonl', '');

          return {
            messages,
            sessionName
          };
        } catch (readError) {
          console.warn('Failed to read session file:', readError);
          return null;
        }
      } catch (readdirError) {
        console.warn('Failed to read history directory:', readdirError);
        return null;
      }
    } catch (error) {
      console.warn('Failed to read last session history:', error);
      return null;
    }
  }

  /**
   * Read the accumulated cost from .git/shakespeare/COST file
   * @returns The accumulated cost as a number, or 0 if the file doesn't exist
   */
  async readCost(): Promise<number> {
    try {
      const costPath = join(this.workingDir, ".git", "shakespeare", "COST");
      const content = await this.fs.readFile(costPath, "utf8");
      const cost = parseFloat(content.trim());
      return isNaN(cost) ? 0 : cost;
    } catch {
      return 0;
    }
  }

  /**
   * Write the accumulated cost to .git/shakespeare/COST file
   * @param cost The accumulated cost in USD
   */
  async writeCost(cost: number): Promise<void> {
    const shakespeareDir = join(this.workingDir, ".git", "shakespeare");
    const costPath = join(shakespeareDir, "COST");

    try {
      // Ensure .git/shakespeare directory exists
      await this.fs.mkdir(shakespeareDir, { recursive: true });

      // Write the cost with 6 decimal places for precision
      await this.fs.writeFile(costPath, cost.toFixed(6) + "\n");
    } catch (error) {
      console.warn(`Failed to write .git/shakespeare/COST file: ${error}`);
    }
  }

  /**
   * Read template metadata from .git/shakespeare/template.json file
   * @returns Template metadata object or null if not found or invalid
   */
  async readTemplate(): Promise<{ name: string; description: string; url: string } | null> {
    try {
      const templatePath = join(this.workingDir, ".git", "shakespeare", "template.json");
      const content = await this.fs.readFile(templatePath, "utf8");
      const template = JSON.parse(content);

      // Validate that required fields exist
      if (template && typeof template.name === 'string' &&
          typeof template.description === 'string' &&
          typeof template.url === 'string') {
        return {
          name: template.name,
          description: template.description,
          url: template.url,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Write template metadata to .git/shakespeare/template.json file
   * @param template Template metadata with name, description, and url
   */
  async writeTemplate(template: { name: string; description: string; url: string }): Promise<void> {
    const shakespeareDir = join(this.workingDir, ".git", "shakespeare");
    const templatePath = join(shakespeareDir, "template.json");

    try {
      // Ensure .git/shakespeare directory exists
      await this.fs.mkdir(shakespeareDir, { recursive: true });

      // Write the template metadata as formatted JSON
      await this.fs.writeFile(templatePath, JSON.stringify(template, null, 2) + "\n");
    } catch (error) {
      console.warn(`Failed to write .git/shakespeare/template.json file: ${error}`);
    }
  }

  /**
   * Read the last finish reason from .git/ai/FINISH_REASON file
   * @returns The finish reason string, or null if file doesn't exist or is empty
   */
  async readFinishReason(): Promise<string | null> {
    try {
      const finishReasonPath = join(this.workingDir, ".git", "ai", "FINISH_REASON");
      const content = await this.fs.readFile(finishReasonPath, "utf8");
      const trimmed = content.trim();
      return trimmed || null;
    } catch {
      return null;
    }
  }

  /**
   * Write the finish reason to .git/ai/FINISH_REASON file
   * @param finishReason The finish reason string, or null to clear
   */
  async writeFinishReason(finishReason: string | null): Promise<void> {
    const aiDir = join(this.workingDir, ".git", "ai");
    const finishReasonPath = join(aiDir, "FINISH_REASON");

    try {
      // Ensure .git/ai directory exists
      await this.fs.mkdir(aiDir, { recursive: true });

      // Write the finish reason (empty string if null)
      const content = finishReason ? finishReason.trim() + "\n" : "";
      await this.fs.writeFile(finishReasonPath, content);
    } catch (error) {
      console.warn(`Failed to write .git/ai/FINISH_REASON file: ${error}`);
    }
  }
}
