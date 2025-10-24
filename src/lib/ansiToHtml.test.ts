import { describe, it, expect } from 'vitest';
import { ansiToHtml, containsAnsiCodes, stripAnsiCodes } from './ansiToHtml';

describe('ansiToHtml', () => {
  it('should convert basic color codes to HTML', () => {
    const input = '\u001b[31mRed text\u001b[0m';
    const output = ansiToHtml(input);
    expect(output).toContain('text-red-500');
    expect(output).toContain('Red text');
  });

  it('should handle multiple color codes', () => {
    const input = '\u001b[31mRed\u001b[0m \u001b[32mGreen\u001b[0m';
    const output = ansiToHtml(input);
    expect(output).toContain('text-red-500');
    expect(output).toContain('text-green-500');
  });

  it('should return original text if no ANSI codes', () => {
    const input = 'Plain text';
    const output = ansiToHtml(input);
    expect(output).toBe(input);
  });

  it('should handle bold text', () => {
    const input = '\u001b[1mBold text\u001b[0m';
    const output = ansiToHtml(input);
    expect(output).toContain('font-bold');
  });

  it('should handle background colors', () => {
    const input = '\u001b[41mRed background\u001b[0m';
    const output = ansiToHtml(input);
    expect(output).toContain('bg-red-500');
  });
});

describe('containsAnsiCodes', () => {
  it('should detect ANSI codes', () => {
    expect(containsAnsiCodes('\u001b[31mRed\u001b[0m')).toBe(true);
    expect(containsAnsiCodes('\u001b[1mBold\u001b[0m')).toBe(true);
  });

  it('should return false for plain text', () => {
    expect(containsAnsiCodes('Plain text')).toBe(false);
    expect(containsAnsiCodes('')).toBe(false);
  });
});

describe('stripAnsiCodes', () => {
  it('should remove basic color codes', () => {
    const input = '\u001b[31mRed text\u001b[0m';
    const output = stripAnsiCodes(input);
    expect(output).toBe('Red text');
  });

  it('should remove multiple ANSI codes', () => {
    const input = '\u001b[31mRed\u001b[0m \u001b[32mGreen\u001b[0m \u001b[1mBold\u001b[0m';
    const output = stripAnsiCodes(input);
    expect(output).toBe('Red Green Bold');
  });

  it('should remove cursor movement codes', () => {
    const input = 'Text\u001b[2AMove up\u001b[1BMove down';
    const output = stripAnsiCodes(input);
    expect(output).toBe('TextMove upMove down');
  });

  it('should remove clear screen codes', () => {
    const input = 'Before\u001b[2JAfter';
    const output = stripAnsiCodes(input);
    expect(output).toBe('BeforeAfter');
  });

  it('should handle text without ANSI codes', () => {
    const input = 'Plain text';
    const output = stripAnsiCodes(input);
    expect(output).toBe(input);
  });

  it('should handle empty string', () => {
    const output = stripAnsiCodes('');
    expect(output).toBe('');
  });

  it('should handle npm output with ANSI codes', () => {
    const input = '\u001b[1m\u001b[32madded 142 packages\u001b[39m\u001b[22m in 3s';
    const output = stripAnsiCodes(input);
    expect(output).toBe('added 142 packages in 3s');
  });

  it('should handle git status output with ANSI codes', () => {
    const input = 'On branch \u001b[32mmain\u001b[m\nYour branch is up to date';
    const output = stripAnsiCodes(input);
    expect(output).toBe('On branch main\nYour branch is up to date');
  });

  it('should preserve newlines and spaces', () => {
    const input = '\u001b[31mLine 1\u001b[0m\n\u001b[32mLine 2\u001b[0m\n  Indented';
    const output = stripAnsiCodes(input);
    expect(output).toBe('Line 1\nLine 2\n  Indented');
  });
});
