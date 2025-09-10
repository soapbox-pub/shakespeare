import { describe, it, expect, beforeEach } from 'vitest';
import { EchoCommand } from './echo';

describe('EchoCommand', () => {
  let echoCommand: EchoCommand;
  const testCwd = '/test/dir';

  beforeEach(() => {
    echoCommand = new EchoCommand();
  });

  it('should have correct command properties', () => {
    expect(echoCommand.name).toBe('echo');
    expect(echoCommand.description).toBe('Display text');
    expect(echoCommand.usage).toBe('echo [text...]');
  });

  it('should echo single argument', async () => {
    const result = await echoCommand.execute(['hello'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello\n');
    expect(result.stderr).toBe('');
  });

  it('should echo multiple arguments with spaces', async () => {
    const result = await echoCommand.execute(['hello', 'world', 'test'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world test\n');
    expect(result.stderr).toBe('');
  });

  it('should handle empty arguments', async () => {
    const result = await echoCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('\n');
    expect(result.stderr).toBe('');
  });

  it('should handle arguments with special characters', async () => {
    const result = await echoCommand.execute(['hello!', '@world', '#test'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello! @world #test\n');
    expect(result.stderr).toBe('');
  });
});