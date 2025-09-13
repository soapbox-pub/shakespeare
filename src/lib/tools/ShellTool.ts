import { z } from "zod";
import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand } from "../commands/ShellCommand";
import {
  CatCommand,
  CdCommand,
  ClearCommand,
  CpCommand,
  CutCommand,
  DateCommand,
  DiffCommand,
  EchoCommand,
  EnvCommand,
  FindCommand,
  GitCommand,
  GrepCommand,
  HeadCommand,
  LsCommand,
  MkdirCommand,
  MvCommand,
  PwdCommand,
  RmCommand,
  SortCommand,
  TailCommand,
  TouchCommand,
  TrCommand,
  UniqCommand,
  WcCommand,
  WhoamiCommand,
  WhichCommand
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

  readonly description = "Execute shell commands like cat, ls, cd, pwd, rm, cp, mv, echo, head, tail, grep, find, wc, touch, mkdir, sort, uniq, cut, tr, diff, which, whoami, date, env, clear, git. Supports compound commands with &&, ||, ;, and | operators";

  readonly inputSchema = z.object({
    command: z.string().describe(
      'Shell command to execute, e.g. "cat file.txt", "ls -la", "cd src", "pwd", "sort file.txt", "diff file1 file2", "git status", "git add .", "git commit -m \'message\'". Supports compound commands with &&, ||, ;, and | operators, e.g. "pwd && ls -la", "cat file.txt | grep pattern", "git add . && git commit -m \'update\'"'
    ),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
    this.commands = new Map();

    // Register available commands
    this.registerCommand(new CatCommand(fs));
    this.registerCommand(new CdCommand(fs));
    this.registerCommand(new ClearCommand());
    this.registerCommand(new CpCommand(fs));
    this.registerCommand(new CutCommand(fs));
    this.registerCommand(new DateCommand());
    this.registerCommand(new DiffCommand(fs));
    this.registerCommand(new EchoCommand());
    this.registerCommand(new EnvCommand());
    this.registerCommand(new FindCommand(fs));
    this.registerCommand(new GitCommand(fs));
    this.registerCommand(new GrepCommand(fs));
    this.registerCommand(new HeadCommand(fs));
    this.registerCommand(new LsCommand(fs));
    this.registerCommand(new MkdirCommand(fs));
    this.registerCommand(new MvCommand(fs));
    this.registerCommand(new PwdCommand());
    this.registerCommand(new RmCommand(fs));
    this.registerCommand(new SortCommand(fs));
    this.registerCommand(new TailCommand(fs));
    this.registerCommand(new TouchCommand(fs));
    this.registerCommand(new TrCommand(fs));
    this.registerCommand(new UniqCommand(fs));
    this.registerCommand(new WcCommand(fs));
    this.registerCommand(new WhoamiCommand());

    // Register which command last so it has access to all other commands
    this.registerCommand(new WhichCommand(this.commands));
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

  /**
   * Parse compound commands separated by &&, ||, ;, or |
   */
  private parseCompoundCommand(commandStr: string): Array<{ command: string; operator?: string }> {
    const commands: Array<{ command: string; operator?: string }> = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let i = 0;

    while (i < commandStr.length) {
      const char = commandStr[i];
      const nextChar = commandStr[i + 1];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (!inQuotes) {
        // Check for compound operators
        if (char === '&' && nextChar === '&') {
          // && operator
          if (current.trim()) {
            commands.push({ command: current.trim(), operator: '&&' });
            current = '';
          }
          i++; // Skip next character
        } else if (char === '|' && nextChar === '|') {
          // || operator
          if (current.trim()) {
            commands.push({ command: current.trim(), operator: '||' });
            current = '';
          }
          i++; // Skip next character
        } else if (char === '|' && nextChar !== '|') {
          // | operator (pipe)
          if (current.trim()) {
            commands.push({ command: current.trim(), operator: '|' });
            current = '';
          }
        } else if (char === ';') {
          // ; operator
          if (current.trim()) {
            commands.push({ command: current.trim(), operator: ';' });
            current = '';
          }
        } else {
          current += char;
        }
      } else {
        current += char;
      }

      i++;
    }

    // Add the last command
    if (current.trim()) {
      commands.push({ command: current.trim() });
    }

    return commands;
  }

  /**
   * Execute a single command and return the result
   */
  private async executeSingleCommand(commandStr: string, input?: string): Promise<{ stdout: string; stderr: string; exitCode: number; newCwd?: string }> {
    const { name, args: cmdArgs } = this.parseCommand(commandStr);

    if (!name) {
      return { stdout: '', stderr: 'Error: No command specified', exitCode: 1 };
    }

    // Check if command exists
    const command = this.commands.get(name);
    if (!command) {
      const availableCommands = Array.from(this.commands.keys()).join(', ');
      return {
        stdout: '',
        stderr: `Error: Command '${name}' not found\nAvailable commands: ${availableCommands}`,
        exitCode: 127
      };
    }

    try {
      // Execute the command
      const result = await command.execute(cmdArgs, this.cwd, input);

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode,
        newCwd: result.newCwd,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: `Error executing command '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: 1,
      };
    }
  }

  async execute(args: ShellToolParams): Promise<string> {
    const { command: commandStr } = args;

    if (!commandStr.trim()) {
      return "Error: Empty command";
    }

    // Parse compound commands
    const commands = this.parseCompoundCommand(commandStr);

    if (commands.length === 0) {
      return "Error: No command specified";
    }

    // If it's a simple command (no operators), use the optimized single command execution
    if (commands.length === 1) {
      return this.executeSimpleCommand(commands[0].command);
    }

    // Execute compound commands
    return this.executeCompoundCommands(commands);
  }

  /**
   * Execute a simple command (no compound operators)
   */
  private async executeSimpleCommand(commandStr: string): Promise<string> {
    const result = await this.executeSingleCommand(commandStr);

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
  }

  /**
   * Execute compound commands with operators (&&, ||, ;, |)
   */
  private async executeCompoundCommands(commands: Array<{ command: string; operator?: string }>): Promise<string> {
    const outputs: string[] = [];
    let lastExitCode = 0;
    let pipeInput = '';

    for (let i = 0; i < commands.length; i++) {
      const { command: commandStr, operator } = commands[i];
      const prevOperator = i > 0 ? commands[i - 1].operator : undefined;

      // Handle conditional execution based on previous operator
      if (prevOperator === '&&' && lastExitCode !== 0) {
        // Previous command failed and we have &&, skip this command
        continue;
      }

      if (prevOperator === '||' && lastExitCode === 0) {
        // Previous command succeeded and we have ||, skip this command
        continue;
      }

      // Execute the command
      let result: { stdout: string; stderr: string; exitCode: number; newCwd?: string };

      if (prevOperator === '|') {
        // Handle pipe: pass previous output as input to current command
        result = await this.executeSingleCommand(commandStr, pipeInput);
      } else {
        result = await this.executeSingleCommand(commandStr);
      }

      // Update working directory if command changed it
      if (result.newCwd) {
        this.cwd = result.newCwd;
      }

      lastExitCode = result.exitCode;

      // Handle output based on current operator
      if (operator === '|') {
        // For pipe, store output for next command
        pipeInput = result.stdout;
      } else {
        // For other operators, add to outputs
        let output = '';

        if (result.stdout) {
          output += result.stdout;
        }

        if (result.stderr) {
          if (output) output += '\n';
          output += result.stderr;
        }

        // Add exit code info for non-zero exits (except for pipes)
        if (result.exitCode !== 0) {
          if (output) output += '\n';
          output += `Exit code: ${result.exitCode}`;
        }

        if (output) {
          outputs.push(output);
        }

        // Reset pipe input for non-pipe commands
        pipeInput = '';
      }
    }

    // Handle final pipe output
    if (pipeInput) {
      outputs.push(pipeInput);
    }

    return outputs.length > 0 ? outputs.join('\n') : '(no output)';
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