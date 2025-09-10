import { describe, it, expect } from 'vitest';
import { ClearCommand } from './clear';

describe('ClearCommand', () => {
  const clearCommand = new ClearCommand();

  it('should return ANSI clear screen sequence', async () => {
    const result = await clearCommand.execute([], '/test');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('\x1b[2J\x1b[H');
    expect(result.stderr).toBe('');
  });

  it('should error when arguments provided', async () => {
    const result = await clearCommand.execute(['arg'], '/test');
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('arguments not supported');
  });
});