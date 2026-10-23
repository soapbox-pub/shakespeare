import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git reset', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && echo y > src/y.ts && git add -A && git commit -qm second');
    await sh.ok('echo c >> a.txt && git commit -qam third');
  });

  afterEach(() => sh.dispose());

  it('--hard moves HEAD, removes files missing from the target, and restores deleted ones', async () => {
    await sh.ok('rm src/x.ts && echo junk > a.txt && echo u > untracked.txt');
    expect(await sh.ok('git reset --hard HEAD~2')).toMatch(/^HEAD is now at [0-9a-f]{7} first\n$/);
    expect(await sh.read('a.txt')).toBe('a\n');
    expect(await sh.read('src/x.ts')).toBe('x\n');
    expect(await sh.run('cat src/y.ts')).toMatch(/No such file/);
    expect(await sh.ok('git status -s')).toBe('?? untracked.txt\n');
    expect(await sh.ok('git log --format=%s')).toBe('first\n');

    expect(await sh.ok('git reset --hard ORIG_HEAD')).toMatch(/third\n$/);
    expect(await sh.read('src/y.ts')).toBe('y\n');
  });

  it('accepts short hashes', async () => {
    const hash = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    expect(await sh.ok(`git reset -q --hard ${hash}`)).toBe('(no output)');
    expect(await sh.ok('git log -1 --format=%s')).toBe('second\n');
  });

  it('--mixed (the default) keeps the working tree and reports unstaged changes', async () => {
    expect(await sh.ok('git reset HEAD~1')).toBe('Unstaged changes after reset:\nM\ta.txt\n');
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n');
    expect(await sh.read('a.txt')).toBe('a\nb\nc\n');
    await sh.ok('git reset -q HEAD~1');
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n?? src/y.ts\n');
  });

  it('--soft keeps the index', async () => {
    expect(await sh.ok('git reset --soft HEAD~1')).toBe('(no output)');
    expect(await sh.ok('git status -s')).toBe('M  a.txt\n');
  });

  it('unstages paths', async () => {
    await sh.ok('echo d >> a.txt && echo n > new.txt && git add -A');
    expect(await sh.ok('git reset a.txt')).toBe('Unstaged changes after reset:\nM\ta.txt\n');
    expect(await sh.ok('git status -s')).toBe(' M a.txt\nA  new.txt\n');
    expect(await sh.ok('git reset -q')).toBe('(no output)');
    expect(await sh.ok('git status -s')).toBe(' M a.txt\n?? new.txt\n');
  });

  it('resets paths to another commit', async () => {
    expect(await sh.ok('git reset -q HEAD~2 -- a.txt src')).toBe('(no output)');
    expect(await sh.ok('git status -s')).toBe('MM a.txt\nD  src/y.ts\n?? src/y.ts\n');
  });

  it('--keep refuses to lose local changes', async () => {
    await sh.ok('echo dirty >> a.txt');
    expect(await sh.run('git reset --keep HEAD~1')).toBe(
      "error: Entry 'a.txt' not uptodate. Cannot merge.\nfatal: Could not reset index file to revision 'HEAD~1'.\nExit code: 128",
    );
    await sh.ok('git checkout -- a.txt && echo local >> src/x.ts');
    await sh.ok('git reset --keep HEAD~1');
    expect(await sh.ok('git status -s')).toBe(' M src/x.ts\n');
    expect(await sh.read('a.txt')).toBe('a\nb\n');
  });

  it('reports git\'s errors', async () => {
    const hint = "Use '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'";
    expect(await sh.run('git reset nope')).toBe(`fatal: ambiguous argument 'nope': unknown revision or path not in the working tree.\n${hint}\nExit code: 128`);
    expect(await sh.run('git reset --soft HEAD -- a.txt')).toBe('fatal: Cannot do soft reset with paths.\nExit code: 128');
    expect(await sh.run('git reset --hard HEAD a.txt')).toBe('fatal: Cannot do hard reset with paths.\nExit code: 128');
    expect(await sh.run('git reset --bogus')).toMatch(/^error: unknown option `bogus'[\s\S]*Exit code: 129$/);
  });
});
