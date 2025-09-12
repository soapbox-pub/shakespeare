import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'env' command
 * Display environment variables
 */
export class EnvCommand implements ShellCommand {
  name = 'env';
  description = 'Display environment variables';
  usage = 'env';

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    // env doesn't accept arguments in this simple implementation
    if (args.length > 0) {
      return createErrorResult(`${this.name}: arguments not supported in this implementation`);
    }

    // Simulate common environment variables that would be found in a development environment
    const envVars = [
      'HOME=/home/user',
      'PATH=/usr/local/bin:/usr/bin:/bin',
      'SHELL=/bin/bash',
      'USER=user',
      'PWD=' + cwd,
      'TERM=xterm-256color',
      'LANG=en_US.UTF-8',
      'NODE_ENV=development',
      'EDITOR=nano'
    ];

    const output = envVars.join('\n') + '\n';
    return createSuccessResult(output);
  }
}