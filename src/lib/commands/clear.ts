import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'clear' command
 * Clear terminal screen
 */
export class ClearCommand implements ShellCommand {
  name = 'clear';
  description = 'Clear terminal screen';
  usage = 'clear';

  async execute(args: string[], _cwd: string, _input?: string): Promise<ShellCommandResult> {
    // clear doesn't accept any arguments
    if (args.length > 0) {
      return createErrorResult(`${this.name}: arguments not supported`);
    }

    // Return ANSI escape sequence to clear screen and move cursor to top-left
    return createSuccessResult('\x1b[2J\x1b[H');
  }
}