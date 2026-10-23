import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git rev-parse and plumbing', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && git commit -qam second');
  });

  afterEach(() => sh.dispose());

  it('resolves revisions', async () => {
    const [head, parent] = (await sh.ok('git log --format=%H')).trim().split('\n');
    expect(await sh.ok('git rev-parse HEAD')).toBe(`${head}\n`);
    expect(await sh.ok('git rev-parse --short HEAD~1')).toBe(`${parent.slice(0, 7)}\n`);
    expect(await sh.ok(`git rev-parse ${parent.slice(0, 6)}`)).toBe(`${parent}\n`);
    expect(await sh.ok('git rev-parse --verify -q HEAD^{commit}')).toBe(`${head}\n`);
    expect(await sh.ok('git rev-parse --abbrev-ref HEAD')).toBe('main\n');
    expect(await sh.ok('git rev-parse --symbolic-full-name HEAD')).toBe('refs/heads/main\n');
    expect(await sh.ok('git rev-parse --show-toplevel --is-inside-work-tree')).toBe('/projects/repo\ntrue\n');
  });

  it('fails like git on bad revisions', async () => {
    expect(await sh.run('git rev-parse nope')).toContain("fatal: ambiguous argument 'nope'");
    expect(await sh.run('git rev-parse --verify nope')).toContain('fatal: Needed a single revision');
    expect(await sh.run('git rev-parse --verify -q nope')).toBe('Exit code: 1');
  });

  it('cat-file prints objects', async () => {
    expect(await sh.ok('git cat-file -t HEAD')).toBe('commit\n');
    expect(await sh.ok('git cat-file -t HEAD:src')).toBe('tree\n');
    expect(await sh.ok('git cat-file -p HEAD~1:a.txt')).toBe('a\n');
    expect(await sh.ok('git cat-file blob HEAD:a.txt')).toBe('a\nb\n');
    expect(await sh.ok('git cat-file -s HEAD:a.txt')).toBe('4\n');
    expect(await sh.ok('git cat-file -p HEAD')).toMatch(/^tree [0-9a-f]{40}\nparent [0-9a-f]{40}\nauthor .+\ncommitter .+\n\nsecond\n/);
    expect(await sh.ok('git cat-file -p HEAD^{tree}')).toMatch(/^100644 blob [0-9a-f]{40}\ta\.txt\n040000 tree [0-9a-f]{40}\tsrc\n$/);
    expect(await sh.run('git cat-file -e HEAD:nope')).toBe('Exit code: 1');
  });

  it('ls-tree lists trees', async () => {
    expect(await sh.ok('git ls-tree HEAD')).toMatch(/^100644 blob [0-9a-f]{40}\ta\.txt\n040000 tree [0-9a-f]{40}\tsrc\n$/);
    expect(await sh.ok('git ls-tree -r --name-only HEAD')).toBe('a.txt\nsrc/x.ts\n');
    expect(await sh.ok('git ls-tree --name-only HEAD src')).toBe('src\n');
    expect(await sh.ok('git ls-tree --name-only HEAD src/')).toBe('src/x.ts\n');
    expect(await sh.ok('git ls-tree -r -t --name-only HEAD')).toBe('a.txt\nsrc\nsrc/x.ts\n');
  });

  it('rev-list and merge-base walk history', async () => {
    await sh.ok('git switch -q -c side HEAD~1 && echo s > s.txt && git add s.txt && git commit -qm side');
    expect(await sh.ok('git rev-list --count main')).toBe('2\n');
    expect(await sh.ok('git rev-list --count main..side')).toBe('1\n');
    expect(await sh.ok('git rev-list --count main...side')).toBe('2\n');
    const base = (await sh.ok('git rev-parse main~1')).trim();
    expect(await sh.ok('git merge-base main side')).toBe(`${base}\n`);
    expect(await sh.run('git merge-base --is-ancestor main~1 side')).toBe('(no output)');
    expect(await sh.run('git merge-base --is-ancestor main side')).toBe('Exit code: 1');
  });
});
