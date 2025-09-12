import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'whoami' command
 * Display current username
 */
export class WhoamiCommand implements ShellCommand {
  name = 'whoami';
  description = 'Display current username';
  usage = 'whoami';

  async execute(args: string[], _cwd: string, _input?: string): Promise<ShellCommandResult> {
    // whoami doesn't accept any arguments
    if (args.length > 0) {
      return createErrorResult(`${this.name}: extra operand '${args[0]}'`);
    }

    return createSuccessResult('user\n');
  }
}