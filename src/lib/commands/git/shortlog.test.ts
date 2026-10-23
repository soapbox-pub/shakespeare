import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git shortlog', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q');
    await sh.ok('echo a > a.txt && git add a.txt && git commit -qm first --author="Alice Smith <alice@example.com>"');
    await sh.ok('mkdir src && echo x > src/x.ts && git add src && git commit -qm second --author="Bob <bob@example.com>"');
    await sh.ok('echo b >> a.txt && git commit -qam "third change" --author="Alice Smith <alice@example.com>"');
  });

  afterEach(() => sh.dispose());

  it('groups commit subjects by author, oldest first', async () => {
    expect(await sh.ok('git shortlog')).toBe('Alice Smith (2):\n      first\n      third change\n\nBob (1):\n      second\n\n');
    expect(await sh.ok('git shortlog HEAD')).toBe(await sh.ok('git shortlog'));
  });

  it('summarizes counts', async () => {
    expect(await sh.ok('git shortlog -s')).toBe('     2\tAlice Smith\n     1\tBob\n');
    expect(await sh.ok('git shortlog -sne')).toBe('     2\tAlice Smith <alice@example.com>\n     1\tBob <bob@example.com>\n');
  });

  it('sorts by count with -n', async () => {
    await sh.ok('echo c >> a.txt && git commit -qam fourth --author="Bob <bob@example.com>"');
    await sh.ok('echo d >> a.txt && git commit -qam fifth --author="Bob <bob@example.com>"');
    expect(await sh.ok('git shortlog -sn')).toBe('     3\tBob\n     2\tAlice Smith\n');
    expect(await sh.ok('git shortlog -s')).toBe('     2\tAlice Smith\n     3\tBob\n');
  });

  it('takes revisions, ranges and paths', async () => {
    expect(await sh.ok('git shortlog HEAD~1')).toBe('Alice Smith (1):\n      first\n\nBob (1):\n      second\n\n');
    expect(await sh.ok('git shortlog -s HEAD~2..HEAD')).toBe('     1\tAlice Smith\n     1\tBob\n');
    expect(await sh.ok('git shortlog -s ^HEAD~1 HEAD')).toBe('     1\tAlice Smith\n');
    expect(await sh.ok('git shortlog -s -- src')).toBe('     1\tBob\n');
  });

  it('rejects unknown revisions', async () => {
    expect(await sh.run('git shortlog nosuch')).toContain("fatal: ambiguous argument 'nosuch'");
  });
});
