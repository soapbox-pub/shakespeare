import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git rm', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir -p d/e && echo f > d/f && echo g > d/e/g && git add -A && git commit -qm first');
  });

  afterEach(() => sh.dispose());

  it('removes files from the index and working tree', async () => {
    expect(await sh.ok('git rm a.txt')).toBe("rm 'a.txt'\n");
    expect(await sh.run('cat a.txt')).toMatch(/No such file/);
    expect(await sh.ok('git status -s')).toBe('D  a.txt\n');
  });

  it('keeps the file with --cached', async () => {
    expect(await sh.ok('git rm -q --cached a.txt')).toBe('(no output)');
    expect(await sh.read('a.txt')).toBe('a\n');
    expect(await sh.ok('git status -s')).toBe('D  a.txt\n?? a.txt\n');
  });

  it('needs -r for directories', async () => {
    expect(await sh.run('git rm d')).toBe("fatal: not removing 'd' recursively without -r\nExit code: 128");
    expect(await sh.ok('git rm -r d')).toBe("rm 'd/e/g'\nrm 'd/f'\n");
    expect(await sh.run('ls d')).toMatch(/No such file/);
  });

  it('matches globs and supports --dry-run', async () => {
    expect(await sh.ok("git rm -n 'd/*'")).toBe("rm 'd/e/g'\nrm 'd/f'\n");
    expect(await sh.ok('git status -s')).toBe('(no output)');
  });

  it('protects local and staged changes unless forced', async () => {
    await sh.ok('echo m >> a.txt');
    expect(await sh.run('git rm a.txt')).toBe(
      'error: the following file has local modifications:\n    a.txt\n(use --cached to keep the file, or -f to force removal)\nExit code: 1',
    );
    await sh.ok('git add a.txt');
    expect(await sh.run('git rm a.txt')).toBe(
      'error: the following file has changes staged in the index:\n    a.txt\n(use --cached to keep the file, or -f to force removal)\nExit code: 1',
    );
    await sh.ok('echo z >> a.txt');
    expect(await sh.run('git rm --cached a.txt')).toBe(
      'error: the following file has staged content different from both the\nfile and the HEAD:\n    a.txt\n(use -f to force removal)\nExit code: 1',
    );
    await sh.ok('git rm -qf a.txt');
    expect(await sh.ok('git status -s')).toBe('D  a.txt\n');
  });

  it('reports unmatched pathspecs', async () => {
    expect(await sh.run('git rm nope')).toBe("fatal: pathspec 'nope' did not match any files\nExit code: 128");
    expect(await sh.ok('git rm --ignore-unmatch nope')).toBe('(no output)');
  });
});
