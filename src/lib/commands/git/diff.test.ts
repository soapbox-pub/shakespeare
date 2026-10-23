import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git diff', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && printf "1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n9\\n10\\n" > n.txt && echo a > a.txt && git add -A && git commit -qm first');
  });

  afterEach(() => sh.dispose());

  it('shows unstaged changes with correct hunks', async () => {
    await sh.ok('sed -i "s/^5$/five/" n.txt');
    expect(await sh.ok('git diff')).toBe(
      'diff --git a/n.txt b/n.txt\n' +
      'index f00c965..33011fd 100644\n' +
      '--- a/n.txt\n' +
      '+++ b/n.txt\n' +
      '@@ -2,7 +2,7 @@\n' +
      ' 2\n 3\n 4\n-5\n+five\n 6\n 7\n 8\n',
    );
  });

  it('separates staged, unstaged and HEAD comparisons', async () => {
    await sh.ok('echo staged >> a.txt && git add a.txt && echo unstaged >> a.txt');
    expect(await sh.ok('git diff --name-only')).toBe('a.txt\n');
    expect(await sh.ok('git diff --cached')).toContain('@@ -1 +1,2 @@\n a\n+staged\n');
    expect(await sh.ok('git diff')).toContain('@@ -1,2 +1,3 @@\n a\n staged\n+unstaged\n');
    expect(await sh.ok('git diff HEAD')).toContain('@@ -1 +1,3 @@\n a\n+staged\n+unstaged\n');
    expect(await sh.ok('git diff --staged --stat')).toBe(' a.txt | 1 +\n 1 file changed, 1 insertion(+)\n');
  });

  it('compares commits, ranges and paths', async () => {
    await sh.ok('echo b >> a.txt && echo new > new.txt && git add -A && git commit -qm second');
    expect(await sh.ok('git diff HEAD~1 HEAD --name-status')).toBe('M\ta.txt\nA\tnew.txt\n');
    expect(await sh.ok('git diff HEAD~1..HEAD --numstat')).toBe('1\t0\ta.txt\n1\t0\tnew.txt\n');
    const short = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    expect(await sh.ok(`git diff ${short} -- a.txt`)).toContain('+b\n');
    expect(await sh.ok(`git diff ${short} -- a.txt`)).not.toContain('new.txt');
    expect(await sh.ok('git diff HEAD~1 HEAD -- new.txt')).toContain('new file mode 100644\nindex 0000000..3e75765\n--- /dev/null\n+++ b/new.txt\n@@ -0,0 +1 @@\n+new\n');
  });

  it('reports deletions and missing newlines', async () => {
    await sh.ok('rm a.txt && printf "1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n9\\n10" > n.txt');
    const out = await sh.ok('git diff');
    expect(out).toContain('diff --git a/a.txt b/a.txt\ndeleted file mode 100644\nindex 7898192..0000000\n--- a/a.txt\n+++ /dev/null\n@@ -1 +0,0 @@\n-a\n');
    expect(out).toContain('-10\n+10\n\\ No newline at end of file\n');
  });

  it('supports --exit-code, --quiet and --stat', async () => {
    expect(await sh.run('git diff --exit-code')).toBe('(no output)');
    await sh.ok('echo more >> a.txt');
    expect(await sh.run('git diff --quiet')).toContain('Exit code: 1');
    expect(await sh.ok('git diff --stat')).toBe(' a.txt | 1 +\n 1 file changed, 1 insertion(+)\n');
    expect(await sh.ok('git diff --shortstat')).toBe(' 1 file changed, 1 insertion(+)\n');
  });

  it('rejects unknown revisions and options', async () => {
    expect(await sh.run('git diff nope')).toContain("ambiguous argument 'nope'");
    expect(await sh.run('git diff --bogus')).toContain("unknown option `bogus'");
  });
});
