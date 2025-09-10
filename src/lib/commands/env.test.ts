import { describe, it, expect } from 'vitest';
import { EnvCommand } from './env';

describe('EnvCommand', () => {
  const envCommand = new EnvCommand();

  it('should display environment variables', async () => {
    const result = await envCommand.execute([], '/test/dir');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('HOME=/home/user');
    expect(result.stdout).toContain('PATH=/usr/local/bin:/usr/bin:/bin');
    expect(result.stdout).toContain('SHELL=/bin/bash');
    expect(result.stdout).toContain('USER=user');
    expect(result.stdout).toContain('PWD=/test/dir');
    expect(result.stdout).toContain('TERM=xterm-256color');
    expect(result.stdout).toContain('LANG=en_US.UTF-8');
    expect(result.stdout).toContain('NODE_ENV=development');
    expect(result.stdout).toContain('EDITOR=nano');
    expect(result.stderr).toBe('');
  });

  it('should show current working directory in PWD', async () => {
    const result = await envCommand.execute([], '/different/path');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('PWD=/different/path');
    expect(result.stderr).toBe('');
  });

  it('should error when arguments provided', async () => {
    const result = await envCommand.execute(['arg'], '/test');
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('arguments not supported');
  });
});