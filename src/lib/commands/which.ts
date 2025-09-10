import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'which' command
 * Locate a command and show its path
 */
export class WhichCommand implements ShellCommand {
  name = 'which';
  description = 'Locate a command';
  usage = 'which command...';

  private commands: Map<string, ShellCommand>;

  constructor(commands: Map<string, ShellCommand>) {
    this.commands = commands;
  }

  async execute(args: string[], _cwd: string): Promise<ShellCommandResult> {
    if (args.length === 0) {
      return createErrorResult(`${this.name}: missing operand`);
    }

    const results: string[] = [];
    let hasError = false;

    for (const commandName of args) {
      if (this.commands.has(commandName)) {
        results.push(`/usr/bin/${commandName}`);
      } else {
        results.push(`${this.name}: no ${commandName} in (/usr/bin)`);
        hasError = true;
      }
    }

    const output = results.join('\n') + (results.length > 0 ? '\n' : '');

    if (hasError) {
      return createErrorResult(output, 1);
    }

    return createSuccessResult(output);
  }
}