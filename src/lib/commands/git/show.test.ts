import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git show', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && git commit -qam second');
  });

  afterEach(() => sh.dispose());

  it('shows a commit with its patch', async () => {
    const out = await sh.ok('git show');
    expect(out).toMatch(/^commit [0-9a-f]{40}\nAuthor: .+\nDate: .+\n\n {4}second\n/);
    expect(out).toContain('\ndiff --git a/a.txt b/a.txt\nindex 7898192..422c2b7 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1,2 @@\n a\n+b\n');
  });

  it('shows the root commit as all additions', async () => {
    const out = await sh.ok('git show HEAD~1 --format=%s');
    expect(out).toContain('first\n\ndiff --git a/a.txt b/a.txt\nnew file mode 100644\nindex 0000000..7898192\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1 @@\n+a\n');
  });

  it('prints file contents for rev:path, including from short hashes', async () => {
    const short = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    expect(await sh.ok(`git show ${short}:a.txt`)).toBe('a\n');
    expect(await sh.ok('git show HEAD:a.txt')).toBe('a\nb\n');
    expect(await sh.ok('git show HEAD~1:./src/x.ts')).toBe('x\n');
    await sh.ok('git show HEAD~1:a.txt > /tmp/old.txt');
    expect(await sh.read('/tmp/old.txt')).toBe('a\n');
    expect(await sh.run('git show HEAD:missing.txt')).toContain("fatal: path 'missing.txt' does not exist in 'HEAD'");
  });

  it('keeps binary blobs byte-for-byte when redirected', async () => {
    await sh.fs.writeFile('/projects/repo/img.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0xff]));
    await sh.ok('git add img.png && git commit -qm img && rm img.png');
    await sh.ok('git show HEAD:img.png > restored.png');
    const bytes = await sh.fs.readFile('/projects/repo/restored.png');
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0xff]);
  });

  it('lists trees', async () => {
    expect(await sh.ok('git show HEAD:')).toBe('tree HEAD:\n\na.txt\nsrc/\n');
    expect(await sh.ok('git show HEAD^{tree}')).toBe('tree HEAD^{tree}\n\na.txt\nsrc/\n');
  });

  it('supports -s, --stat, --name-only and --oneline', async () => {
    expect(await sh.ok('git show -s --format=%s')).toBe('second\n');
    expect(await sh.ok('git show --stat --oneline')).toMatch(/^[0-9a-f]{7} second\n a\.txt \| 1 \+\n 1 file changed, 1 insertion\(\+\)\n$/);
    expect(await sh.ok('git show --name-only --format=')).toBe('\na.txt\n');
  });

  it('shows annotated tags', async () => {
    await sh.ok('git tag -a v1 -m "release one"');
    const out = await sh.ok('git show v1 -s');
    expect(out).toMatch(/^tag v1\nTagger: .+\nDate: .+\n\nrelease one\n\ncommit [0-9a-f]{40}\n/);
  });

  it('errors on unknown revisions', async () => {
    expect(await sh.run('git show nope')).toContain("fatal: ambiguous argument 'nope': unknown revision");
  });
});
