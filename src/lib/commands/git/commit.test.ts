import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git commit', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && git add a.txt');
  });

  afterEach(() => sh.dispose());

  it('reports a root commit with a stat summary', async () => {
    const out = await sh.ok('git commit -m "first"');
    expect(out).toMatch(/^\[main \(root-commit\) [0-9a-f]{7}\] first\n 1 file changed, 1 insertion\(\+\)\n create mode 100644 a\.txt/);
  });

  it('accepts bundled flags like -qm and -am', async () => {
    expect(await sh.ok('git commit -qm first')).toBe('(no output)');
    await sh.ok('echo b >> a.txt');
    const out = await sh.ok('git commit -am second');
    expect(out).toMatch(/\[main [0-9a-f]{7}\] second\n 1 file changed, 1 insertion\(\+\)/);
    expect(await sh.ok('git log --format=%s')).toBe('second\nfirst\n');
  });

  it('joins multiple -m paragraphs and reads -F', async () => {
    await sh.ok('printf "from file\\n" > /tmp/msg && git commit -q -m one -m two');
    expect(await sh.ok('git log -1 --format=%B')).toMatch(/^one\n\ntwo\n/);
    await sh.ok('echo b >> a.txt && git commit -qaF /tmp/msg');
    expect(await sh.ok('git log -1 --format=%s')).toBe('from file\n');
  });

  it('refuses to commit nothing, and an empty message', async () => {
    await sh.ok('git commit -qm first');
    const nothing = await sh.run('git commit -m again');
    expect(nothing).toContain('nothing to commit, working tree clean');
    expect(nothing).toContain('Exit code: 1');

    await sh.ok('echo b >> a.txt');
    expect(await sh.run('git commit -m again')).toContain('no changes added to commit');
    expect(await sh.run('git commit -a')).toContain('Aborting commit due to empty commit message.');
  });

  it('amends the last commit, keeping its message with --no-edit', async () => {
    await sh.ok('git commit -qm first && echo b > b.txt && git add b.txt');
    await sh.ok('git commit -q --amend --no-edit');
    expect(await sh.ok('git log --format=%s')).toBe('first\n');
    expect(await sh.ok('git show --name-only --format=')).toContain('b.txt');
    await sh.ok('git commit -q --amend -m renamed');
    expect(await sh.ok('git log --format=%s')).toBe('renamed\n');
  });

  it('allows empty commits and overrides the author', async () => {
    await sh.ok('git commit -qm first');
    await sh.ok('git commit -q --allow-empty -m empty --author="Jane Doe <jane@example.com>"');
    expect(await sh.ok('git log -1 --format="%an <%ae> %s"')).toBe('Jane Doe <jane@example.com> empty\n');
  });

  it('commits only the given paths', async () => {
    await sh.ok('git commit -qm first && echo b >> a.txt && echo n > new.txt && git add new.txt');
    await sh.ok('git commit -qm "only a" a.txt');
    expect(await sh.ok('git show --name-only --format=')).toContain('a.txt');
  });

  it('uses MERGE_MSG after a conflicted cherry-pick', async () => {
    await sh.ok('git commit -qm first && git branch other');
    await sh.ok('echo main > a.txt && git commit -qam main-change');
    await sh.ok('git switch -q other && echo other > a.txt && git commit -qam other-change && git switch -q main');
    const out = await sh.run('git cherry-pick other');
    expect(out).toContain('CONFLICT (content): Merge conflict in a.txt');
    await sh.ok('echo resolved > a.txt && git add a.txt && git commit -q');
    expect(await sh.ok('git log -1 --format=%s')).toBe('other-change\n');
    expect(await sh.ok('git status --short')).toBe('(no output)');
  });
});
