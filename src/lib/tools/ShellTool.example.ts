/**
 * Example usage of the ShellTool
 *
 * This file demonstrates how to use the ShellTool to execute shell commands
 * in your application. The ShellTool provides a safe, sandboxed environment
 * for running basic file operations.
 */

import { ShellTool } from './ShellTool';
import { Git } from '../git';
import type { JSRuntimeFS } from '../JSRuntime';

/**
 * Example function showing how to use ShellTool
 */
export async function exampleShellUsage(fs: JSRuntimeFS, projectRoot: string) {
  // Create a shell tool instance
  const shell = new ShellTool(fs, projectRoot, new Git(fs));

  console.log('Available commands:', shell.getAvailableCommands());
  console.log('Current directory:', shell.getCurrentWorkingDirectory());

  // Example 1: Display current directory
  console.log('\n--- Example 1: Show current directory ---');
  const pwdResult = await shell.execute({ command: 'pwd' });
  console.log(pwdResult);

  // Example 2: List directory contents
  console.log('\n--- Example 2: List files ---');
  const lsResult = await shell.execute({ command: 'ls' });
  console.log(lsResult);

  // Example 3: List with long format
  console.log('\n--- Example 3: List with details ---');
  const lsLongResult = await shell.execute({ command: 'ls -l' });
  console.log(lsLongResult);

  // Example 4: Display a file
  console.log('\n--- Example 4: Display package.json ---');
  const catResult = await shell.execute({ command: 'cat package.json' });
  console.log(catResult);

  // Example 5: Echo text
  console.log('\n--- Example 5: Echo message ---');
  const echoResult = await shell.execute({ command: 'echo Hello, World!' });
  console.log(echoResult);

  // Example 6: Change directory
  console.log('\n--- Example 6: Change directory ---');
  const cdResult = await shell.execute({ command: 'cd src' });
  console.log(cdResult);
  console.log('New directory:', shell.getCurrentWorkingDirectory());

  // Example 7: Handle errors gracefully
  console.log('\n--- Example 7: Handle non-existent file ---');
  const errorResult = await shell.execute({
    command: 'cat nonexistent-file.txt'
  });
  console.log(errorResult);

  // Example 8: Try unknown command
  console.log('\n--- Example 8: Unknown command ---');
  const unknownResult = await shell.execute({
    command: 'unknown-command arg1 arg2'
  });
  console.log(unknownResult);

  // Example 9: Compound commands with &&
  console.log('\n--- Example 9: Compound commands with && ---');
  const andResult = await shell.execute({
    command: 'pwd && echo "Current directory listed above"'
  });
  console.log(andResult);

  // Example 10: Compound commands with ||
  console.log('\n--- Example 10: Compound commands with || ---');
  const orResult = await shell.execute({
    command: 'cat nonexistent.txt || echo "File not found, showing fallback message"'
  });
  console.log(orResult);

  // Example 11: Sequential commands with ;
  console.log('\n--- Example 11: Sequential commands with ; ---');
  const sequentialResult = await shell.execute({
    command: 'echo "First command"; echo "Second command"; pwd'
  });
  console.log(sequentialResult);

  // Example 12: Pipe commands
  console.log('\n--- Example 12: Pipe commands ---');
  const pipeResult = await shell.execute({
    command: 'echo "line1\nline2\nline3\nline4\nline5" | head -n 3'
  });
  console.log(pipeResult);

  // Example 13: Complex pipe chain
  console.log('\n--- Example 13: Complex pipe chain ---');
  const complexPipeResult = await shell.execute({
    command: 'echo "apple\nbanana\napple\ncherry\nbanana\napple" | sort | uniq'
  });
  console.log(complexPipeResult);

  // Example 14: Mixed compound operators
  console.log('\n--- Example 14: Mixed compound operators ---');
  const mixedResult = await shell.execute({
    command: 'echo "Processing..." && echo "data1\ndata2\ndata3" | wc -l && echo "Done!"'
  });
  console.log(mixedResult);
}

/**
 * Example React hook for using ShellTool
 */
export function useShell(fs: JSRuntimeFS, cwd: string) {
  const shell = new ShellTool(fs, cwd, new Git(fs));

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
    this.shell = new ShellTool(fs, projectRoot, new Git(fs));
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
    this.shell = new ShellTool(fs, projectRoot, new Git(fs));
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