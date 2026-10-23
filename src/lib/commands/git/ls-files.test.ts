import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git ls-files', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && echo y > src/y.ts && echo "*.log" > .gitignore && git add -A && git commit -qm first');
    await sh.ok('echo m >> a.txt && rm src/x.ts && echo l > x.log && mkdir nd && echo f > nd/f');
  });

  afterEach(() => sh.dispose());

  it('lists cached files by default', async () => {
    expect(await sh.ok('git ls-files')).toBe('.gitignore\na.txt\nsrc/x.ts\nsrc/y.ts\n');
    expect(await sh.ok('git ls-files src')).toBe('src/x.ts\nsrc/y.ts\n');
    expect(await sh.ok("git ls-files '*.ts'")).toBe('src/x.ts\nsrc/y.ts\n');
  });

  it('lists modified and deleted files', async () => {
    expect(await sh.ok('git ls-files -m')).toBe('a.txt\nsrc/x.ts\n');
    expect(await sh.ok('git ls-files -d')).toBe('src/x.ts\n');
    expect(await sh.ok('git ls-files -t -m -d')).toBe('C a.txt\nR src/x.ts\nC src/x.ts\n');
  });

  it('lists other files', async () => {
    expect(await sh.ok('git ls-files -o')).toBe('nd/f\nx.log\n');
    expect(await sh.ok('git ls-files -o --exclude-standard')).toBe('nd/f\n');
    expect(await sh.ok('git ls-files -o --exclude-standard --directory')).toBe('nd/\n');
    expect(await sh.ok('git ls-files -i -o --exclude-standard')).toBe('x.log\n');
  });

  it('shows stage information', async () => {
    expect(await sh.ok('git ls-files -s a.txt')).toMatch(/^100644 [0-9a-f]{40} 0\ta\.txt\n$/);
    expect(await sh.ok("git ls-files --format='%(objectmode) %(path)' a.txt")).toBe('100644 a.txt\n');
  });

  it('separates entries with NUL under -z', async () => {
    expect(await sh.ok('git ls-files -z src')).toBe('src/x.ts\0src/y.ts\0');
  });

  it('fails --error-unmatch for unknown paths', async () => {
    expect(await sh.run('git ls-files --error-unmatch nope')).toBe(
      "error: pathspec 'nope' did not match any file(s) known to git\nDid you forget to 'git add'?\nExit code: 1",
    );
    expect(await sh.ok('git ls-files --error-unmatch a.txt')).toBe('a.txt\n');
  });
});
