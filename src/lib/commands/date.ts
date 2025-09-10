import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'date' command
 * Display current date and time
 */
export class DateCommand implements ShellCommand {
  name = 'date';
  description = 'Display current date and time';
  usage = 'date [+FORMAT]';

  async execute(args: string[], _cwd: string): Promise<ShellCommandResult> {
    try {
      const now = new Date();

      // Handle format string
      if (args.length > 0) {
        const format = args[0];

        if (format.startsWith('+')) {
          const formatStr = format.slice(1);
          const formatted = this.formatDate(now, formatStr);
          return createSuccessResult(formatted + '\n');
        } else {
          return createErrorResult(`${this.name}: invalid date '${format}'`);
        }
      }

      // Default format (similar to GNU date)
      const defaultFormat = now.toString();
      return createSuccessResult(defaultFormat + '\n');

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatDate(date: Date, format: string): string {
    const formatMap: Record<string, string> = {
      // Date formats
      '%Y': date.getFullYear().toString(),
      '%y': date.getFullYear().toString().slice(-2),
      '%m': (date.getMonth() + 1).toString().padStart(2, '0'),
      '%d': date.getDate().toString().padStart(2, '0'),
      '%H': date.getHours().toString().padStart(2, '0'),
      '%M': date.getMinutes().toString().padStart(2, '0'),
      '%S': date.getSeconds().toString().padStart(2, '0'),
      '%A': date.toLocaleDateString('en-US', { weekday: 'long' }),
      '%a': date.toLocaleDateString('en-US', { weekday: 'short' }),
      '%B': date.toLocaleDateString('en-US', { month: 'long' }),
      '%b': date.toLocaleDateString('en-US', { month: 'short' }),
      '%s': Math.floor(date.getTime() / 1000).toString(),
      '%%': '%'
    };

    let result = format;
    for (const [pattern, replacement] of Object.entries(formatMap)) {
      result = result.replace(new RegExp(pattern, 'g'), replacement);
    }

    return result;
  }
}