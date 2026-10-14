import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'npx' command. Nothing can be installed, so it runs
 * the named command when it is one of the shell's built-ins (e.g. `npx tsc`).
 */
export class NpxCommand implements ShellCommand {
  name = 'npx';
  description = 'Run a package binary (only built-in commands such as tsc)';
  usage = 'npx [-y] command [args...]';

  private commands: Map<string, ShellCommand>;

  constructor(commands: Map<string, ShellCommand>) {
    this.commands = commands;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    let i = 0;
    while (i < args.length && args[i].startsWith('-')) {
      if (args[i] === '--') {
        i++;
        break;
      }
      i += args[i] === '-p' || args[i] === '--package' ? 2 : 1;
    }

    const name = args[i];
    if (!name) {
      return createErrorResult(`${this.name}: missing command\nUsage: ${this.usage}`);
    }

    const command = this.commands.get(name);
    if (!command || command === this) {
      return createErrorResult(`${this.name}: ${name}: not available (packages can't be installed here)`, 127);
    }

    return command.execute(args.slice(i + 1), cwd, input);
  }
}
