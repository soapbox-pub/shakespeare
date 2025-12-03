import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { DotAI } from '@/lib/DotAI';
import type OpenAI from 'openai';

export interface Chat {
  id: string;
  name: string;
  path: string;
  lastModified: Date;
}

export interface ChatsManagerOptions {
  fs: JSRuntimeFS;
  /** Chats directory path (default: /chats) */
  chatsPath: string;
}

export class ChatsManager {
  fs: JSRuntimeFS;
  dir: string;

  constructor(options: ChatsManagerOptions) {
    this.fs = options.fs;
    this.dir = options.chatsPath;
  }

  async init() {
    try {
      await this.fs.mkdir(this.dir);
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Get all chats
   */
  async getChats(): Promise<Chat[]> {
    try {
      const chatDirs = await this.fs.readdir(this.dir);
      const chats: Chat[] = [];

      for (const chatId of chatDirs) {
        const chatPath = `${this.dir}/${chatId}`;
        try {
          const stat = await this.fs.stat(chatPath);
          if (stat.isDirectory()) {
            chats.push({
              id: chatId,
              name: chatId,
              path: chatPath,
              lastModified: new Date(stat.mtimeMs || Date.now()),
            });
          }
        } catch {
          // Skip if we can't stat this directory
          continue;
        }
      }

      return chats;
    } catch {
      return [];
    }
  }

  /**
   * Get a single chat by ID
   */
  async getChat(chatId: string): Promise<Chat | null> {
    try {
      const chatPath = `${this.dir}/${chatId}`;
      const stat = await this.fs.stat(chatPath);

      if (!stat.isDirectory()) {
        return null;
      }

      return {
        id: chatId,
        name: chatId,
        path: chatPath,
        lastModified: new Date(stat.mtimeMs || Date.now()),
      };
    } catch {
      return null;
    }
  }

  /**
   * Create a new chat with an initial message
   */
  async createChat(
    chatId: string,
    initialMessage: string,
  ): Promise<Chat> {
    const chatPath = `${this.dir}/${chatId}`;

    // Create the chat directory
    await this.fs.mkdir(chatPath, { recursive: true });

    // Create messages file with initial user message
    const messagesPath = `${chatPath}/messages.jsonl`;
    const userMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
      role: 'user',
      content: initialMessage,
    };
    await this.fs.writeFile(messagesPath, JSON.stringify(userMessage) + '\n');

    const stat = await this.fs.stat(chatPath);

    return {
      id: chatId,
      name: chatId,
      path: chatPath,
      lastModified: new Date(stat.mtimeMs || Date.now()),
    };
  }

  /**
   * Delete a chat
   */
  async deleteChat(chatId: string): Promise<void> {
    const chatPath = `${this.dir}/${chatId}`;

    try {
      // Recursively delete the chat directory
      await this.deleteChatDirectory(chatPath);
    } catch (error) {
      console.error(`Failed to delete chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Recursively delete a directory and all its contents
   */
  private async deleteChatDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath);

      for (const entry of entries) {
        const entryPath = `${dirPath}/${entry}`;
        const stat = await this.fs.stat(entryPath);

        if (stat.isDirectory()) {
          await this.deleteChatDirectory(entryPath);
        } else {
          await this.fs.unlink(entryPath);
        }
      }

      await this.fs.rmdir(dirPath);
    } catch (error) {
      console.error(`Failed to delete directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Read messages from a chat
   */
  async readMessages(chatId: string): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const messagesPath = `${this.dir}/${chatId}/messages.jsonl`;

    try {
      const content = await this.fs.readFile(messagesPath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      for (const line of lines) {
        try {
          const message = JSON.parse(line) as OpenAI.Chat.Completions.ChatCompletionMessageParam;
          messages.push(message);
        } catch (parseError) {
          console.warn('Failed to parse message from chat:', parseError);
        }
      }

      return messages;
    } catch {
      return [];
    }
  }

  /**
   * Write messages to a chat
   */
  async writeMessages(
    chatId: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): Promise<void> {
    const messagesPath = `${this.dir}/${chatId}/messages.jsonl`;

    try {
      // Convert messages to JSONL format
      const jsonlContent = messages.map(message => JSON.stringify(message)).join('\n');
      const finalContent = jsonlContent + (messages.length > 0 ? '\n' : '');

      // Write the entire file
      await this.fs.writeFile(messagesPath, finalContent);
    } catch (error) {
      console.warn(`Failed to write messages to chat: ${error}`);
      throw error;
    }
  }

  /**
   * Append a message to a chat
   */
  async appendMessage(
    chatId: string,
    message: OpenAI.Chat.Completions.ChatCompletionMessageParam,
  ): Promise<void> {
    const messagesPath = `${this.dir}/${chatId}/messages.jsonl`;

    try {
      const messageJson = JSON.stringify(message) + '\n';
      
      // Append to the file
      try {
        const existingContent = await this.fs.readFile(messagesPath, 'utf8');
        await this.fs.writeFile(messagesPath, existingContent + messageJson);
      } catch {
        // File doesn't exist, create it
        await this.fs.writeFile(messagesPath, messageJson);
      }
    } catch (error) {
      console.warn(`Failed to append message to chat: ${error}`);
      throw error;
    }
  }

  /**
   * Generate a unique chat ID
   */
  static generateChatId(): string {
    const now = new Date();
    const dateString = now.toISOString();

    // Generate a random 3-character suffix to avoid collisions
    const randomSuffix = Math.random().toString(36).substring(2, 5);

    // Format: YYYY-MM-DDTHH-MM-SSZ-suffix
    const chatId = `${
      dateString.replace(/:/g, "-").slice(0, dateString.indexOf("."))
    }Z-${randomSuffix}`;

    return chatId;
  }
}
