import { describe, it, expect } from 'vitest';
import { WhoamiCommand } from './whoami';

describe('WhoamiCommand', () => {
  const whoamiCommand = new WhoamiCommand();

  it('should return current username', async () => {
    const result = await whoamiCommand.execute([], '/test');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('user\n');
    expect(result.stderr).toBe('');
  });

  it('should error when arguments provided', async () => {
    const result = await whoamiCommand.execute(['arg'], '/test');
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('extra operand');
  });
});