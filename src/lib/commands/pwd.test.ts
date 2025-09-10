import { describe, it, expect, beforeEach } from 'vitest';
import { PwdCommand } from './pwd';

describe('PwdCommand', () => {
  let pwdCommand: PwdCommand;
  const testCwd = '/test/current/directory';

  beforeEach(() => {
    pwdCommand = new PwdCommand();
  });

  it('should have correct command properties', () => {
    expect(pwdCommand.name).toBe('pwd');
    expect(pwdCommand.description).toBe('Print working directory');
    expect(pwdCommand.usage).toBe('pwd');
  });

  it('should return current working directory', async () => {
    const result = await pwdCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(testCwd);
    expect(result.stderr).toBe('');
  });

  it('should reject arguments', async () => {
    const result = await pwdCommand.execute(['arg1'], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('too many arguments');
    expect(result.stdout).toBe('');
  });
});