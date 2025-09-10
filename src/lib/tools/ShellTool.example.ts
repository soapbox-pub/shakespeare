/**
 * Example usage of the ShellTool
 * 
 * This file demonstrates how to use the ShellTool to execute shell commands
 * in your application. The ShellTool provides a safe, sandboxed environment
 * for running basic file operations.
 */

import { ShellTool } from './ShellTool';
import type { JSRuntimeFS } from '../JSRuntime';

/**
 * Example function showing how to use ShellTool
 */
export async function exampleShellUsage(fs: JSRuntimeFS, projectRoot: string) {
  // Create a shell tool instance
  const shell = new ShellTool(fs, projectRoot);

  console.log('Available commands:', shell.getAvailableCommands());
  console.log('Current directory:', shell.getCurrentWorkingDirectory());

  // Example 1: Display a file
  console.log('\n--- Example 1: Display package.json ---');
  const catResult = await shell.execute({ command: 'cat package.json' });
  console.log(catResult);

  // Example 2: Try to display multiple files
  console.log('\n--- Example 2: Display multiple files ---');
  const multiFileResult = await shell.execute({ 
    command: 'cat package.json README.md' 
  });
  console.log(multiFileResult);

  // Example 3: Handle errors gracefully
  console.log('\n--- Example 3: Handle non-existent file ---');
  const errorResult = await shell.execute({ 
    command: 'cat nonexistent-file.txt' 
  });
  console.log(errorResult);

  // Example 4: Handle quoted filenames with spaces
  console.log('\n--- Example 4: Quoted filename ---');
  const quotedResult = await shell.execute({ 
    command: 'cat "file with spaces.txt"' 
  });
  console.log(quotedResult);

  // Example 5: Try unknown command
  console.log('\n--- Example 5: Unknown command ---');
  const unknownResult = await shell.execute({ 
    command: 'unknown-command arg1 arg2' 
  });
  console.log(unknownResult);
}

/**
 * Example React hook for using ShellTool
 */
export function useShell(fs: JSRuntimeFS, cwd: string) {
  const shell = new ShellTool(fs, cwd);

  const executeCommand = async (command: string): Promise<string> => {
    try {
      return await shell.execute({ command });
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  return {
    executeCommand,
    getCurrentDirectory: () => shell.getCurrentWorkingDirectory(),
    setCurrentDirectory: (newCwd: string) => shell.setCurrentWorkingDirectory(newCwd),
    getAvailableCommands: () => shell.getAvailableCommands(),
  };
}

/**
 * Example integration with AI tools
 * Shows how the ShellTool can be used as part of an AI assistant
 */
export class AIShellIntegration {
  private shell: ShellTool;

  constructor(fs: JSRuntimeFS, projectRoot: string) {
    this.shell = new ShellTool(fs, projectRoot);
  }

  /**
   * Process natural language requests and convert to shell commands
   */
  async processNaturalLanguageRequest(request: string): Promise<string> {
    const lowerRequest = request.toLowerCase();

    // Simple pattern matching for demonstration
    if (lowerRequest.includes('show me') && lowerRequest.includes('file')) {
      // Extract filename from request
      const fileMatch = request.match(/file\s+["']?([^"'\s]+)["']?/i);
      if (fileMatch) {
        const filename = fileMatch[1];
        return await this.shell.execute({ command: `cat ${filename}` });
      }
    }

    if (lowerRequest.includes('list') && lowerRequest.includes('command')) {
      const commands = this.shell.getAvailableCommands();
      return commands.map(cmd => `${cmd.name}: ${cmd.description}`).join('\n');
    }

    if (lowerRequest.includes('current') && lowerRequest.includes('directory')) {
      return `Current directory: ${this.shell.getCurrentWorkingDirectory()}`;
    }

    return 'I can help you with file operations. Try asking me to "show me a file" or "list available commands".';
  }
}

/**
 * Example CLI-like interface
 */
export class SimpleCLI {
  private shell: ShellTool;
  private history: string[] = [];

  constructor(fs: JSRuntimeFS, projectRoot: string) {
    this.shell = new ShellTool(fs, projectRoot);
  }

  async executeCommand(command: string): Promise<string> {
    this.history.push(command);
    
    // Handle built-in commands
    if (command.trim() === 'help') {
      const commands = this.shell.getAvailableCommands();
      return [
        'Available commands:',
        ...commands.map(cmd => `  ${cmd.usage} - ${cmd.description}`),
        '',
        'Built-in commands:',
        '  help - Show this help message',
        '  history - Show command history',
        '  pwd - Show current directory',
      ].join('\n');
    }

    if (command.trim() === 'history') {
      return this.history.map((cmd, i) => `${i + 1}: ${cmd}`).join('\n');
    }

    if (command.trim() === 'pwd') {
      return this.shell.getCurrentWorkingDirectory();
    }

    // Execute through shell tool
    return await this.shell.execute({ command });
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}