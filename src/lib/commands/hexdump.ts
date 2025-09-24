import { join } from "path-browserify";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'hexdump' command
 * Display file contents in hexadecimal format
 */
export class HexdumpCommand implements ShellCommand {
  name = 'hexdump';
  description = 'Display file contents in hexadecimal format';
  usage = 'hexdump [-C] [-n length] [-s skip] [file...]';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    // Parse command line options
    const options = this.parseOptions(args);

    if (options.error) {
      return createErrorResult(options.error);
    }

    // If input is provided (from pipe), process it
    if (input !== undefined) {
      const buffer = Buffer.from(input, 'utf8');
      const output = this.formatHexdump(buffer, options);
      return createSuccessResult(output);
    }

    // If no files specified, show usage
    if (options.files.length === 0) {
      return createErrorResult(`${this.name}: missing file operand\nUsage: ${this.usage}`);
    }

    try {
      const outputs: string[] = [];

      for (const filePath of options.files) {
        try {
          // Handle both absolute and relative paths
          let absolutePath: string;

          if (filePath.startsWith('/') || filePath.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(filePath)) {
            // It's an absolute path - use it directly
            absolutePath = filePath;
          } else {
            // It's a relative path - resolve it relative to the current working directory
            absolutePath = join(cwd, filePath);
          }

          // Check if path exists and is a file
          const stats = await this.fs.stat(absolutePath);

          if (stats.isDirectory()) {
            return createErrorResult(`${this.name}: ${filePath}: Is a directory`);
          }

          // Read file content as binary
          const content = await this.fs.readFile(absolutePath);
          const buffer = Buffer.from(content);

          // Format the hexdump
          const hexOutput = this.formatHexdump(buffer, options);

          // Add filename header if multiple files
          if (options.files.length > 1) {
            outputs.push(`==> ${filePath} <==`);
            outputs.push(hexOutput);
          } else {
            outputs.push(hexOutput);
          }

        } catch (error) {
          // Handle file not found or permission errors
          if (error instanceof Error) {
            if (error.message.includes('ENOENT') || error.message.includes('not found')) {
              return createErrorResult(`${this.name}: ${filePath}: No such file or directory`);
            } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
              return createErrorResult(`${this.name}: ${filePath}: Permission denied`);
            } else {
              return createErrorResult(`${this.name}: ${filePath}: ${error.message}`);
            }
          } else {
            return createErrorResult(`${this.name}: ${filePath}: Unknown error`);
          }
        }
      }

      const result = outputs.join('\n');
      return createSuccessResult(result);

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse command line options
   */
  private parseOptions(args: string[]): {
    canonical: boolean;
    length?: number;
    skip: number;
    files: string[];
    error?: string;
  } {
    const options = {
      canonical: false,
      length: undefined as number | undefined,
      skip: 0,
      files: [] as string[],
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-C') {
        options.canonical = true;
      } else if (arg === '-n') {
        // Next argument should be the length
        if (i + 1 >= args.length) {
          return { ...options, error: `${this.name}: option requires an argument -- n` };
        }
        const lengthStr = args[++i];
        const length = parseInt(lengthStr, 10);
        if (isNaN(length) || length < 0) {
          return { ...options, error: `${this.name}: invalid length: ${lengthStr}` };
        }
        options.length = length;
      } else if (arg === '-s') {
        // Next argument should be the skip offset
        if (i + 1 >= args.length) {
          return { ...options, error: `${this.name}: option requires an argument -- s` };
        }
        const skipStr = args[++i];
        const skip = parseInt(skipStr, 10);
        if (isNaN(skip) || skip < 0) {
          return { ...options, error: `${this.name}: invalid skip offset: ${skipStr}` };
        }
        options.skip = skip;
      } else if (arg.startsWith('-')) {
        return { ...options, error: `${this.name}: invalid option -- ${arg.slice(1)}` };
      } else {
        // It's a filename
        options.files.push(arg);
      }
    }

    return options;
  }

  /**
   * Format buffer content as hexdump
   */
  private formatHexdump(buffer: Buffer, options: {
    canonical: boolean;
    length?: number;
    skip: number;
  }): string {
    const lines: string[] = [];
    const bytesPerLine = 16;

    // Apply skip offset
    const startOffset = options.skip;
    if (startOffset >= buffer.length) {
      return ''; // Nothing to display
    }

    // Apply length limit
    let endOffset = buffer.length;
    if (options.length !== undefined) {
      endOffset = Math.min(startOffset + options.length, buffer.length);
    }

    for (let offset = startOffset; offset < endOffset; offset += bytesPerLine) {
      const lineEnd = Math.min(offset + bytesPerLine, endOffset);
      const lineBytes = buffer.subarray(offset, lineEnd);

      if (options.canonical) {
        // Canonical format (-C): address, hex bytes, ASCII
        lines.push(this.formatCanonicalLine(offset, lineBytes));
      } else {
        // Default format: address followed by 16-bit words in hex
        lines.push(this.formatDefaultLine(offset, lineBytes));
      }
    }

    // Add final offset line if we have data
    if (endOffset > startOffset) {
      const finalOffset = endOffset;
      lines.push(this.formatOffsetLine(finalOffset));
    }

    return lines.join('\n');
  }

  /**
   * Format a line in canonical format (-C option)
   */
  private formatCanonicalLine(offset: number, bytes: Buffer): string {
    const addressStr = offset.toString(16).padStart(8, '0');

    // Format hex bytes (2 groups of 8 bytes each)
    const group1: string[] = [];
    const group2: string[] = [];

    for (let i = 0; i < 16; i++) {
      const hexByte = i < bytes.length
        ? bytes[i].toString(16).padStart(2, '0')
        : '  ';

      if (i < 8) {
        group1.push(hexByte);
      } else {
        group2.push(hexByte);
      }
    }

    const hexStr = group1.join(' ') + '  ' + group2.join(' ');

    // Format ASCII representation
    let asciiStr = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte >= 32 && byte <= 126) {
        // Printable ASCII character
        asciiStr += String.fromCharCode(byte);
      } else {
        // Non-printable character
        asciiStr += '.';
      }
    }

    return `${addressStr}  ${hexStr}  |${asciiStr}|`;
  }

  /**
   * Format a line in default format
   */
  private formatDefaultLine(offset: number, bytes: Buffer): string {
    const addressStr = offset.toString(16).padStart(7, '0');

    // Group bytes into 16-bit words (little-endian)
    const words: string[] = [];
    for (let i = 0; i < bytes.length; i += 2) {
      if (i + 1 < bytes.length) {
        // Full 16-bit word (little-endian)
        const word = (bytes[i + 1] << 8) | bytes[i];
        words.push(word.toString(16).padStart(4, '0'));
      } else {
        // Partial word (only one byte)
        const word = bytes[i];
        words.push(word.toString(16).padStart(2, '0') + '  ');
      }
    }

    return `${addressStr} ${words.join(' ')}`;
  }

  /**
   * Format the final offset line
   */
  private formatOffsetLine(offset: number): string {
    return offset.toString(16).padStart(7, '0');
  }
}