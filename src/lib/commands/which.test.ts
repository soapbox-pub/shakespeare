import { describe, it, expect } from 'vitest';
import { WhichCommand } from './which';
import { LsCommand } from './ls';
import { CatCommand } from './cat';
import type { JSRuntimeFS } from '../JSRuntime';

describe('WhichCommand', () => {
  const mockFS = {} as JSRuntimeFS;
  const commands = new Map();
  commands.set('ls', new LsCommand(mockFS));
  commands.set('cat', new CatCommand(mockFS));
  
  const whichCommand = new WhichCommand(commands);

  it('should show path for existing command', async () => {
    const result = await whichCommand.execute(['ls'], '/test');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('/usr/bin/ls\n');
    expect(result.stderr).toBe('');
  });

  it('should handle multiple existing commands', async () => {
    const result = await whichCommand.execute(['ls', 'cat'], '/test');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('/usr/bin/ls\n/usr/bin/cat\n');
    expect(result.stderr).toBe('');
  });

  it('should error for non-existent command', async () => {
    const result = await whichCommand.execute(['nonexistent'], '/test');
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('which: no nonexistent in (/usr/bin)\n');
    expect(result.stdout).toBe('');
  });

  it('should handle mix of existing and non-existent commands', async () => {
    const result = await whichCommand.execute(['ls', 'nonexistent', 'cat'], '/test');
    
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('/usr/bin/ls\nwhich: no nonexistent in (/usr/bin)\n/usr/bin/cat\n');
    expect(result.stdout).toBe('');
  });

  it('should error when no arguments provided', async () => {
    const result = await whichCommand.execute([], '/test');
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('missing operand');
  });
});