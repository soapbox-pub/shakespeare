import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateCommand } from './date';

describe('DateCommand', () => {
  const dateCommand = new DateCommand();

  beforeEach(() => {
    // Mock Date to return consistent values
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-12-25T15:30:45.123Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return current date in default format', async () => {
    const result = await dateCommand.execute([], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('2023');
    expect(result.stdout).toContain('Dec');
    expect(result.stderr).toBe('');
  });

  it('should format date with custom format string', async () => {
    const result = await dateCommand.execute(['+%Y-%m-%d'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('2023-12-25\n');
    expect(result.stderr).toBe('');
  });

  it('should handle time formatting', async () => {
    const result = await dateCommand.execute(['+%H:%M:%S'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d{2}:\d{2}:\d{2}\n/);
    expect(result.stderr).toBe('');
  });

  it('should handle weekday and month names', async () => {
    const result = await dateCommand.execute(['+%A %B'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Monday December\n');
    expect(result.stderr).toBe('');
  });

  it('should handle unix timestamp', async () => {
    const result = await dateCommand.execute(['+%s'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\n/);
    expect(result.stderr).toBe('');
  });

  it('should handle percent literal', async () => {
    const result = await dateCommand.execute(['+%%'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('%\n');
    expect(result.stderr).toBe('');
  });

  it('should error for invalid format (missing +)', async () => {
    const result = await dateCommand.execute(['%Y-%m-%d'], '/test');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('invalid date');
  });
});