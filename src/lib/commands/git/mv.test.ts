import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git mv', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && echo b > b.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
  });

  afterEach(() => sh.dispose());

  it('renames a file', async () => {
    expect(await sh.ok('git mv a.txt c.txt')).toBe('(no output)');
    expect(await sh.read('c.txt')).toBe('a\n');
    expect(await sh.ok('git status -s')).toBe('R  a.txt -> c.txt\n');
  });

  it('moves files into a directory', async () => {
    await sh.ok('git mv -v a.txt b.txt src');
    expect(await sh.ok('git status -s')).toBe('R  a.txt -> src/a.txt\nR  b.txt -> src/b.txt\n');
  });

  it('moves directories', async () => {
    await sh.ok('mkdir lib && git mv src lib');
    expect(await sh.read('lib/src/x.ts')).toBe('x\n');
    expect(await sh.ok('git status -s')).toBe('R  src/x.ts -> lib/src/x.ts\n');
  });

  it('keeps the staged content, not the working tree content', async () => {
    await sh.ok('echo more >> a.txt && git mv a.txt c.txt');
    expect(await sh.ok('git status -s')).toBe('RM a.txt -> c.txt\n');
  });

  it('refuses to overwrite unless forced', async () => {
    expect(await sh.run('git mv a.txt b.txt')).toBe('fatal: destination exists, source=a.txt, destination=b.txt\nExit code: 128');
    await sh.ok('git mv -f a.txt b.txt');
    expect(await sh.read('b.txt')).toBe('a\n');
    expect(await sh.ok('git status -s')).toBe('D  a.txt\nM  b.txt\n');
  });

  it('reports bad sources, and skips errors with -k', async () => {
    expect(await sh.run('git mv nope x')).toBe('fatal: bad source, source=nope, destination=x\nExit code: 128');
    await sh.ok('echo u > u.txt');
    expect(await sh.run('git mv u.txt v.txt')).toBe('fatal: not under version control, source=u.txt, destination=v.txt\nExit code: 128');
    expect(await sh.run('git mv a.txt b.txt nodir')).toBe("fatal: destination 'nodir' is not a directory\nExit code: 128");
    expect(await sh.ok('git mv -k nope a.txt src')).toBe('(no output)');
    expect(await sh.ok('git status -s')).toBe('R  a.txt -> src/a.txt\n?? u.txt\n');
  });

  it('supports --dry-run', async () => {
    expect(await sh.ok('git mv -n a.txt c.txt')).toBe("Checking rename of 'a.txt' to 'c.txt'\nRenaming a.txt to c.txt\n");
    expect(await sh.ok('git status -s')).toBe('(no output)');
  });
});
