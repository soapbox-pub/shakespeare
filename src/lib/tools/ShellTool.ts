import { z } from "zod";
import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand } from "../commands/ShellCommand";
import {
  CatCommand,
  CdCommand,
  CpCommand,
  EchoCommand,
  LsCommand,
  MvCommand,
  PwdCommand,
  RmCommand
} from "../commands";

interface ShellToolParams {
  command: string;
}

/**
 * Shell tool that provides a command-line interface for basic file operations
 */
export class ShellTool implements Tool<ShellToolParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private commands: Map<string, ShellCommand>;

  readonly description = "Execute shell commands like cat, ls, cd, pwd, rm, cp, mv, echo";

  readonly inputSchema = z.object({
    command: z.string().describe(
      'Shell command to execute, e.g. "cat file.txt", "ls -la", "cd src", "pwd"'
    ),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
    this.commands = new Map();

    // Register available commands
    this.registerCommand(new CatCommand(fs));
    this.registerCommand(new CdCommand(fs));
    this.registerCommand(new CpCommand(fs));
    this.registerCommand(new EchoCommand());
    this.registerCommand(new LsCommand(fs));
    this.registerCommand(new MvCommand(fs));
    this.registerCommand(new PwdCommand());
    this.registerCommand(new RmCommand(fs));
  }

  /**
   * Register a shell command
   */
  private registerCommand(command: ShellCommand): void {
    this.commands.set(command.name, command);
  }

  /**
   * Parse a command string into command name and arguments
   */
  private parseCommand(commandStr: string): { name: string; args: string[] } {
    // Simple parsing - split by spaces, respecting quoted strings
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    const [name = '', ...args] = parts;
    return { name, args };
  }

  async execute(args: ShellToolParams): Promise<string> {
    const { command: commandStr } = args;

    if (!commandStr.trim()) {
      return "Error: Empty command";
    }

    const { name, args: cmdArgs } = this.parseCommand(commandStr);

    if (!name) {
      return "Error: No command specified";
    }

    // Check if command exists
    const command = this.commands.get(name);
    if (!command) {
      const availableCommands = Array.from(this.commands.keys()).join(', ');
      return `Error: Command '${name}' not found\nAvailable commands: ${availableCommands}`;
    }

    try {
      // Execute the command
      const result = await command.execute(cmdArgs, this.cwd);

      // Update working directory if command changed it (e.g., cd)
      if (result.newCwd) {
        this.cwd = result.newCwd;
      }

      // Format output
      let output = '';

      if (result.stdout) {
        output += result.stdout;
      }

      if (result.stderr) {
        if (output) output += '\n';
        output += result.stderr;
      }

      // Add exit code info for non-zero exits
      if (result.exitCode !== 0) {
        if (output) output += '\n';
        output += `Exit code: ${result.exitCode}`;
      }

      return output || '(no output)';

    } catch (error) {
      return `Error executing command '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get the current working directory
   */
  getCurrentWorkingDirectory(): string {
    return this.cwd;
  }

  /**
   * Set the current working directory
   */
  setCurrentWorkingDirectory(newCwd: string): void {
    this.cwd = newCwd;
  }

  /**
   * Get list of available commands
   */
  getAvailableCommands(): Array<{ name: string; description: string; usage: string }> {
    return Array.from(this.commands.values()).map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      usage: cmd.usage,
    }));
  }
}