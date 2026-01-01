import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand } from "../commands/ShellCommand";
import { Git } from "../git";
import type { NostrSigner } from "@nostrify/nostrify";
import {
  CatCommand,
  CdCommand,
  ClearCommand,
  CpCommand,
  CurlCommand,
  CutCommand,
  DateCommand,
  DiffCommand,
  EchoCommand,
  EnvCommand,
  FindCommand,
  GitCommand,
  GrepCommand,
  HeadCommand,
  HexdumpCommand,
  LsCommand,
  MkdirCommand,
  MvCommand,
  PwdCommand,
  RmCommand,
  SedCommand,
  ShakespeareCommand,
  SortCommand,
  TailCommand,
  TouchCommand,
  TrCommand,
  UniqCommand,
  UnzipCommand,
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
  private git: Git;
  private commands: Map<string, ShellCommand>;
  private signer?: NostrSigner;
  private corsProxy: string;

  readonly description = "Execute shell commands like cat, ls, cd, pwd, rm, cp, mv, echo, head, tail, grep, find, wc, touch, mkdir, sort, uniq, cut, tr, sed, diff, which, whoami, date, env, clear, git, curl, unzip, hexdump. Supports compound commands with &&, ||, ;, and | operators, and output redirection with > and >> operators";

  readonly inputSchema = z.object({
    command: z.string().describe(
      'Shell command to execute, e.g. "cat file.txt", "ls -la", "cd src", "pwd", "sort file.txt", "diff file1 file2", "git status", "git add .", "git commit -m \'message\'", "curl -X GET https://api.example.com", "curl -H \'Content-Type: application/json\' -d \'{"key":"value"}\' https://api.example.com". Supports compound commands with &&, ||, ;, and | operators, e.g. "pwd && ls -la", "cat file.txt | grep pattern", "git add . && git commit -m \'update\'". Also supports output redirection with > and >> operators, e.g. "echo hello > file.txt", "ls >> output.log"'
    ),
  });

  constructor(fs: JSRuntimeFS, cwd: string, git: Git, corsProxy: string, signer?: NostrSigner) {
    this.fs = fs;
    this.cwd = cwd;
    this.git = git;
    this.corsProxy = corsProxy;
    this.signer = signer;
    this.commands = new Map();

    // Register available commands
    this.registerCommand(new CatCommand(fs));
    this.registerCommand(new CdCommand(fs));
    this.registerCommand(new ClearCommand());
    this.registerCommand(new CpCommand(fs));
    this.registerCommand(new CurlCommand(fs, this.corsProxy));
    this.registerCommand(new CutCommand(fs));
    this.registerCommand(new DateCommand());
    this.registerCommand(new DiffCommand(fs));
    this.registerCommand(new EchoCommand());
    this.registerCommand(new EnvCommand());
    this.registerCommand(new FindCommand(fs));
    this.registerCommand(new GitCommand({ git: this.git, fs, cwd: this.cwd, signer: this.signer }));
    this.registerCommand(new GrepCommand(fs));
    this.registerCommand(new HeadCommand(fs));
    this.registerCommand(new HexdumpCommand(fs));
    this.registerCommand(new LsCommand(fs));
    this.registerCommand(new MkdirCommand(fs));
    this.registerCommand(new MvCommand(fs));
    this.registerCommand(new PwdCommand());
    this.registerCommand(new RmCommand(fs));
    this.registerCommand(new SedCommand(fs));
    this.registerCommand(new ShakespeareCommand());
    this.registerCommand(new SortCommand(fs));
    this.registerCommand(new TailCommand(fs));
    this.registerCommand(new TouchCommand(fs));
    this.registerCommand(new TrCommand(fs));
    this.registerCommand(new UniqCommand(fs));
    this.registerCommand(new UnzipCommand(fs));
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
   * Parse a command string into command name, arguments, and redirection info
   */
  private parseCommand(commandStr: string): { name: string; args: string[]; redirectType?: '>' | '>>'; redirectFile?: string } {
    // First, check for redirection operators
    let redirectType: '>' | '>>' | undefined;
    let redirectFile: string | undefined;
    let actualCommand = commandStr;

    // Look for redirection operators (outside of quotes)
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];
      const nextChar = commandStr[i + 1];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes) {
        if (char === '>' && nextChar === '>') {
          // >> append redirection
          redirectType = '>>';
          actualCommand = commandStr.substring(0, i).trim();
          redirectFile = commandStr.substring(i + 2).trim();
          break;
        } else if (char === '>' && nextChar !== '>') {
          // > overwrite redirection
          redirectType = '>';
          actualCommand = commandStr.substring(0, i).trim();
          redirectFile = commandStr.substring(i + 1).trim();
          break;
        }
      }
    }

    // Remove quotes from redirect file if present
    if (redirectFile) {
      if ((redirectFile.startsWith('"') && redirectFile.endsWith('"')) ||
          (redirectFile.startsWith("'") && redirectFile.endsWith("'"))) {
        redirectFile = redirectFile.slice(1, -1);
      }
    }

    // Parse the actual command part
    const parts: string[] = [];
    let current = '';
    inQuotes = false;
    quoteChar = '';

    for (let i = 0; i < actualCommand.length; i++) {
      const char = actualCommand[i];

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
    return { name, args, redirectType, redirectFile };
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
        // Check for compound operators (but not redirection operators)
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
    const { name, args: cmdArgs, redirectType, redirectFile } = this.parseCommand(commandStr);

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

      // Handle redirection if specified
      if (redirectType && redirectFile) {
        try {
          await this.handleRedirection(result.stdout, redirectType, redirectFile);
          // For redirection, we don't output to stdout
          return {
            stdout: '',
            stderr: result.stderr || '',
            exitCode: result.exitCode,
            newCwd: result.newCwd,
          };
        } catch (redirectError) {
          return {
            stdout: '',
            stderr: `Redirection error: ${redirectError instanceof Error ? redirectError.message : 'Unknown error'}`,
            exitCode: 1,
            newCwd: result.newCwd,
          };
        }
      }

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

  async execute(args: ShellToolParams): Promise<ToolResult> {
    const { command: commandStr } = args;

    if (!commandStr.trim()) {
      return { content: "Error: Empty command" };
    }

    // Parse compound commands
    const commands = this.parseCompoundCommand(commandStr);

    if (commands.length === 0) {
      return { content: "Error: No command specified" };
    }

    // If it's a simple command (no operators), use the optimized single command execution
    if (commands.length === 1) {
      const content = await this.executeSimpleCommand(commands[0].command);
      return { content };
    }

    // Execute compound commands
    const content = await this.executeCompoundCommands(commands);
    return { content };
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
   * Handle output redirection to a file
   */
  private async handleRedirection(output: string, redirectType: '>' | '>>', redirectFile: string): Promise<void> {
    // Resolve the file path relative to current working directory
    const filePath = redirectFile.startsWith('/') ? redirectFile : `${this.cwd}/${redirectFile}`;

    if (redirectType === '>') {
      // Overwrite the file
      await this.fs.writeFile(filePath, output, 'utf8');
    } else if (redirectType === '>>') {
      // Append to the file
      try {
        const existingContent = await this.fs.readFile(filePath, 'utf8');
        await this.fs.writeFile(filePath, existingContent + output, 'utf8');
      } catch (error) {
        // If file doesn't exist, create it
        if (error instanceof Error && error.message.includes('ENOENT')) {
          await this.fs.writeFile(filePath, output, 'utf8');
        } else {
          throw error;
        }
      }
    }
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
   * Get list of available commands (excludes hidden easter eggs)
   */
  getAvailableCommands(): Array<{ name: string; description: string; usage: string }> {
    return Array.from(this.commands.values())
      .filter(cmd => !cmd.isEasterEgg) // Hide easter egg commands from help
      .map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
      }));
  }
}