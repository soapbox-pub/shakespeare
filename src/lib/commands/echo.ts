import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult } from "./ShellCommand";

/**
 * Implementation of the 'echo' command
 * Display text
 */
export class EchoCommand implements ShellCommand {
  name = 'echo';
  description = 'Display text';
  usage = 'echo [text...]';

  async execute(args: string[], _cwd: string): Promise<ShellCommandResult> {
    // Join all arguments with spaces, like real echo
    const output = args.join(' ');

    // echo always succeeds and adds a newline
    return createSuccessResult(output + '\n');
  }
}