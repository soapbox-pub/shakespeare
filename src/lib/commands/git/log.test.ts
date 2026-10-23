import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git log', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && git config user.name Tester && echo a > a.txt && git add a.txt && git commit -qm first');
    await sh.ok('echo b >> a.txt && mkdir src && echo y > src/y.ts && git add -A && git commit -qm "second" -m "body line"');
    await sh.ok('echo c >> a.txt && git commit -qam third');
  });

  afterEach(() => sh.dispose());

  it('prints the medium format with indented messages', async () => {
    const out = await sh.ok('git log -1 HEAD~1');
    expect(out).toMatch(/^commit [0-9a-f]{40}\nAuthor: .+ <.+>\nDate: {3}\w{3} \w{3} \d+ \d\d:\d\d:\d\d \d{4} [+-]\d{4}\n\n {4}second\n {4}\n {4}body line\n/);
  });

  it('supports --oneline, -n, -<n>, --skip and --reverse', async () => {
    expect(await sh.ok('git log --oneline')).toMatch(/^[0-9a-f]{7} third\n[0-9a-f]{7} second\n[0-9a-f]{7} first\n$/);
    expect(await sh.ok('git log --format=%s -2')).toBe('third\nsecond\n');
    expect(await sh.ok('git log --format=%s -n 1')).toBe('third\n');
    expect(await sh.ok('git log --format=%s --max-count=1 --skip=1')).toBe('second\n');
    expect(await sh.ok('git log --format=%s --reverse')).toBe('first\nsecond\nthird\n');
  });

  it('expands format placeholders', async () => {
    const [full, short] = (await sh.ok('git log -1 --format="%H %h"')).trim().split(' ');
    expect(full).toMatch(/^[0-9a-f]{40}$/);
    expect(full.startsWith(short)).toBe(true);
    expect(await sh.ok('git log -1 --pretty=format:"%s|%P" HEAD~2')).toBe('first|\n');
    expect(await sh.ok('git log -1 --format="%an%x09%ad" --date=short')).toMatch(/^.+\t\d{4}-\d\d-\d\d\n$/);
  });

  it('accepts revisions given as short hashes and ranges', async () => {
    const short = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    expect(await sh.ok(`git log --format=%s ${short}`)).toBe('second\nfirst\n');
    expect(await sh.ok('git log --format=%s HEAD~2..HEAD')).toBe('third\nsecond\n');
    expect(await sh.ok('git log --format=%s ^HEAD~1 HEAD')).toBe('third\n');
  });

  it('limits to paths', async () => {
    expect(await sh.ok('git log --format=%s -- src/y.ts')).toBe('second\n');
    expect(await sh.ok('git log --format=%s src')).toBe('second\n');
    expect(await sh.run('git log nope')).toContain("ambiguous argument 'nope'");
  });

  it('shows stats, names and patches like git', async () => {
    expect(await sh.ok('git log --oneline --stat -1 HEAD~1')).toMatch(/^[0-9a-f]{7} second\n a\.txt {4}\| 1 \+\n src\/y\.ts \| 1 \+\n 2 files changed, 2 insertions\(\+\)\n$/);
    expect(await sh.ok('git log --format=%s --name-status -1 HEAD~1')).toBe('second\n\nM\ta.txt\nA\tsrc/y.ts\n');
    const patch = await sh.ok('git log -p -1 --format=%s');
    expect(patch).toContain('third\n\ndiff --git a/a.txt b/a.txt\n');
    expect(patch).toContain('@@ -1,2 +1,3 @@\n a\n b\n+c\n');
  });

  it('filters by message, author and merges', async () => {
    expect(await sh.ok('git log --format=%s --grep=sec')).toBe('second\n');
    expect(await sh.ok('git log --format=%s -i --grep=THIRD')).toBe('third\n');
    expect(await sh.ok('git log --format=%s --author=nobody')).toBe('(no output)');
    expect(await sh.ok('git log --format=%s --no-merges -1')).toBe('third\n');
  });

  it('decorates refs and draws a graph', async () => {
    await sh.ok('git tag v1 HEAD~1');
    expect(await sh.ok('git log --oneline --decorate -2')).toMatch(/^[0-9a-f]{7} \(HEAD -> main\) third\n[0-9a-f]{7} \(tag: v1\) second\n$/);
    expect(await sh.ok('git log --graph --oneline')).toMatch(/^\* [0-9a-f]{7} third\n\* [0-9a-f]{7} second\n\* [0-9a-f]{7} first\n$/);
  });

  it('errors helpfully in an empty repository', async () => {
    const empty = await createGitShell('/projects/empty');
    await empty.ok('git init -q');
    expect(await empty.run('git log')).toContain("does not have any commits yet");
    empty.dispose();
  });
});
