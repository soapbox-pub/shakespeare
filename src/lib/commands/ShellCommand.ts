/**
 * Interface for shell command implementations
 */
export interface ShellCommand {
  /** The name of the command (e.g., 'cat', 'ls', 'cd') */
  name: string;

  /** Brief description of what the command does */
  description: string;

  /** Usage syntax for the command */
  usage: string;

  /** If true, this command is hidden from help and command listings (for easter eggs) */
  isEasterEgg?: boolean;

  /**
   * Execute the command with the given arguments
   * @param args Array of command arguments (excluding the command name itself)
   * @param cwd Current working directory
   * @param input Optional input for pipe operations
   * @returns Promise resolving to the command output or error message
   */
  execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult>;
}

/**
 * Result of executing a shell command
 */
export interface ShellCommandResult {
  /** Exit code (0 for success, non-zero for error) */
  exitCode: number;

  /** Standard output content */
  stdout: string;

  /** 'bytes' when stdout is binary, packed one byte per char (latin1) */
  stdoutKind?: 'text' | 'bytes';

  /** Standard error content */
  stderr: string;

  /** New working directory (for commands like 'cd' that change directory) */
  newCwd?: string;
}

/**
 * Create a successful command result
 */
export function createSuccessResult(stdout: string, newCwd?: string): ShellCommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr: '',
    newCwd,
  };
}

/**
 * Create an error command result
 */
export function createErrorResult(stderr: string, exitCode: number = 1): ShellCommandResult {
  return {
    exitCode,
    stdout: '',
    stderr,
  };
}
/** Pack bytes into a latin1 string (one char per byte), the form just-bash uses for binary stdout. */
export function toLatin1(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return result;
}
