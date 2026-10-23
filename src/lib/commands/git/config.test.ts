import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git config', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q');
  });
  afterEach(() => sh.dispose());

  it('gets, sets and unsets values', async () => {
    expect(await sh.run('git config --get user.nope')).toBe('Exit code: 1');
    await sh.ok('git config core.x 1');
    expect(await sh.ok('git config --get core.x')).toBe('1\n');
    expect(await sh.ok('git config core.x')).toBe('1\n');
    expect(await sh.ok('git config get core.x')).toBe('1\n');
    expect(await sh.ok('git config --list')).toContain('core.x=1\n');
    await sh.ok('git config --unset core.x');
    expect(await sh.run('git config core.x')).toBe('Exit code: 1');
    expect(await sh.run('git config --unset core.x')).toBe('Exit code: 5');
  });

  it('handles user identity, --global and multi-valued keys', async () => {
    await sh.ok('git config --global user.name "Ada L"');
    expect(await sh.ok('git config user.name')).toBe('Ada L\n');
    await sh.ok('git config --add remote.o.fetch a && git config --add remote.o.fetch b');
    expect(await sh.ok('git config --get-all remote.o.fetch')).toBe('a\nb\n');
    expect(await sh.run('git config remote.o.fetch c')).toContain('cannot overwrite multiple values with a single value');
    await sh.ok('git config --replace-all remote.o.fetch c');
    expect(await sh.ok('git config --get-all remote.o.fetch')).toBe('c\n');
    expect(await sh.ok('git config --get-regexp ^remote')).toBe('remote.o.fetch c\n');
    expect(await sh.ok('git config --bool core.bare')).toBe('false\n');
  });
});
