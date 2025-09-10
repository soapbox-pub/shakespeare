import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'pwd' command
 * Print working directory
 */
export class PwdCommand implements ShellCommand {
  name = 'pwd';
  description = 'Print working directory';
  usage = 'pwd';

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    // pwd doesn't accept any arguments in standard Linux
    if (args.length > 0) {
      return createErrorResult(`${this.name}: too many arguments`);
    }

    return createSuccessResult(cwd);
  }
}