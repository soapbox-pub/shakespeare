import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git tag', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && git add . && git commit -qm first && echo b >> a.txt && git commit -qam second');
  });
  afterEach(() => sh.dispose());

  it('creates lightweight and annotated tags on any revision', async () => {
    await sh.ok('git tag v1 && git tag -a v2 -m "release two" && git tag -m msg v3 HEAD~1');
    const short = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    await sh.ok(`git tag v0 ${short}`);
    expect(await sh.ok('git tag')).toBe('v0\nv1\nv2\nv3\n');
    expect(await sh.ok('git tag -n')).toBe('v0              first\nv1              second\nv2              release two\nv3              msg\n');
    expect(await sh.ok("git tag -l 'v[12]'")).toBe('v1\nv2\n');
    expect(await sh.ok('git cat-file -t v2')).toBe('tag\n');
    expect(await sh.ok('git cat-file -t v1')).toBe('commit\n');
    expect(await sh.ok('git rev-parse v3^{commit}')).toBe(await sh.ok('git rev-parse HEAD~1'));
    expect(await sh.ok('git tag --points-at HEAD')).toBe('v1\nv2\n');
    expect(await sh.ok('git tag --contains HEAD')).toBe('v1\nv2\n');
  });

  it('sorts versions on request', async () => {
    await sh.ok('git tag v1.10 && git tag v1.9 && git tag v1.2');
    expect(await sh.ok('git tag')).toBe('v1.10\nv1.2\nv1.9\n');
    expect(await sh.ok('git tag --sort=-v:refname')).toBe('v1.10\nv1.9\nv1.2\n');
  });

  it('forces, deletes and reports errors like git', async () => {
    await sh.ok('git tag v1');
    expect(await sh.run('git tag v1')).toBe("fatal: tag 'v1' already exists\nExit code: 128");
    expect(await sh.ok('git tag -f v1 HEAD~1')).toMatch(/^Updated tag 'v1' \(was [0-9a-f]{7}\)\n$/);
    expect(await sh.run('git tag v9 nosuch')).toBe("fatal: Failed to resolve 'nosuch' as a valid ref.\nExit code: 128");
    expect(await sh.run("git tag 'a b'")).toBe("fatal: 'a b' is not a valid tag name.\nExit code: 128");
    expect(await sh.run('git tag -a v5')).toContain('Please supply the message using either -m or -F option.');
    const out = await sh.run('git tag -d v1 v9');
    expect(out).toMatch(/Deleted tag 'v1' \(was [0-9a-f]{7}\)/);
    expect(out).toContain("error: tag 'v9' not found.");
    expect(out).toContain('Exit code: 1');
    expect(await sh.ok('git tag')).toBe('(no output)');
  });
});
