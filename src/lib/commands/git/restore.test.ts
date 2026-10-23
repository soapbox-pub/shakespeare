import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git restore', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && echo y > src/y.ts && git add -A && git commit -qm second');
  });

  afterEach(() => sh.dispose());

  it('restores the working tree from the index', async () => {
    await sh.ok('echo junk > a.txt && git add a.txt && echo more >> a.txt && rm src/x.ts');
    await sh.ok('git restore a.txt src');
    expect(await sh.read('a.txt')).toBe('junk\n');
    expect(await sh.ok('git status -s')).toBe('M  a.txt\n');
  });

  it('unstages with --staged', async () => {
    await sh.ok('echo junk > a.txt && git add a.txt');
    await sh.ok('git restore --staged a.txt');
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n');
    await sh.ok('git add a.txt && git restore -SW a.txt');
    expect(await sh.ok('git status -s')).toBe('(no output)');
    expect(await sh.read('a.txt')).toBe('a\nb\n');
  });

  it('restores from another commit, removing files the source lacks', async () => {
    await sh.ok('git restore --source=HEAD~1 a.txt src');
    expect(await sh.read('a.txt')).toBe('a\n');
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n D src/y.ts\n');
    await sh.ok('git restore -s HEAD~1 --staged --worktree .');
    expect(await sh.ok('git status -s')).toBe('M  a.txt\nD  src/y.ts\n');
  });

  it('matches globs', async () => {
    await sh.ok('echo q > src/x.ts && echo q > src/y.ts && echo q > a.txt');
    await sh.ok("git restore 'src/*.ts'");
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n');
  });

  it('reports git\'s errors', async () => {
    expect(await sh.run('git restore')).toBe('fatal: you must specify path(s) to restore\nExit code: 128');
    expect(await sh.run('git restore nope')).toBe("error: pathspec 'nope' did not match any file(s) known to git\nExit code: 1");
    expect(await sh.run('git restore -s nope a.txt')).toBe("fatal: could not resolve 'nope'\nExit code: 128");
  });
});
