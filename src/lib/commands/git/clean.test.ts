import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git clean', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok("git init -q && mkdir src && echo a > src/t.ts && printf '*.log\\nbuild/\\n' > .gitignore && git add . && git commit -qm i");
    await sh.ok('mkdir -p build emptyd ud/sub && echo u > src/u.ts && echo u > top.txt && echo l > x.log && echo l > src/y.log && echo b > build/o.js && echo z > ud/sub/z.txt');
  });
  afterEach(() => sh.dispose());

  it('refuses without -f or -n', async () => {
    expect(await sh.run('git clean')).toBe('fatal: clean.requireForce defaults to true and neither -i, -n, nor -f given; refusing to clean\nExit code: 128');
  });

  it('lists what it would remove like git', async () => {
    expect(await sh.ok('git clean -n')).toBe('Would remove src/u.ts\nWould remove top.txt\n');
    expect(await sh.ok('git clean -nd')).toBe('Would remove emptyd/\nWould remove src/u.ts\nWould remove top.txt\nWould remove ud/\n');
    expect(await sh.ok('git clean -ndx')).toBe('Would remove build/\nWould remove emptyd/\nWould remove src/u.ts\nWould remove src/y.log\nWould remove top.txt\nWould remove ud/\nWould remove x.log\n');
    expect(await sh.ok('git clean -nX')).toBe('Would remove src/y.log\nWould remove x.log\n');
    expect(await sh.ok('git clean -ndX')).toBe('Would remove build/\nWould remove src/y.log\nWould remove x.log\n');
    expect(await sh.ok('git clean -n src')).toBe('Would remove src/u.ts\n');
    expect(await sh.ok('git clean -nd -e top.txt')).toBe('Would remove emptyd/\nWould remove src/u.ts\nWould remove ud/\n');
  });

  it('removes files and directories but never .git or tracked files', async () => {
    expect(await sh.ok('git clean -fd')).toBe('Removing emptyd/\nRemoving src/u.ts\nRemoving top.txt\nRemoving ud/\n');
    expect(await sh.ok('git status --porcelain --ignored')).not.toContain('??');
    expect(await sh.read('src/t.ts')).toBe('a\n');
    expect(await sh.read('x.log')).toBe('l\n');
    await sh.ok('git clean -fdxq');
    expect(await sh.run('ls -a')).toBe('.\n..\n.git\n.gitignore\nsrc\n');
    expect(await sh.ok('git log --oneline')).toContain(' i');
  });
});
