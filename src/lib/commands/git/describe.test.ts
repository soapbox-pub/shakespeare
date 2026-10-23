import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

const dir = '/projects/repo';
const tagger = { name: 'Alice', email: 'alice@example.com' };

describe('git describe', () => {
  let sh: GitShell;
  let head: string;
  let root: string;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q');
    await sh.ok('echo a > a.txt && git add a.txt && git commit -qm first');
    await sh.ok('echo b >> a.txt && git commit -qam second');
    await sh.ok('echo c >> a.txt && git commit -qam third');
    head = (await sh.ok('git rev-parse HEAD')).trim();
    root = (await sh.ok('git rev-parse HEAD~2')).trim();
  });

  afterEach(() => sh.dispose());

  it('fails when there are no tags', async () => {
    expect(await sh.run('git describe')).toBe('fatal: No names found, cannot describe anything.\nExit code: 128');
    expect(await sh.ok('git describe --always')).toBe(`${head.slice(0, 7)}\n`);
  });

  it('describes relative to the closest annotated tag', async () => {
    await sh.git.annotatedTag({ dir, ref: 'v1.0', message: 'v1', tagger, object: root });
    expect(await sh.ok('git describe')).toBe(`v1.0-2-g${head.slice(0, 7)}\n`);
    expect(await sh.ok('git describe HEAD~1')).toMatch(/^v1\.0-1-g[0-9a-f]{7}\n$/);
    expect(await sh.ok('git describe HEAD~2')).toBe('v1.0\n');
    expect(await sh.ok('git describe --long HEAD~2')).toBe(`v1.0-0-g${root.slice(0, 7)}\n`);
    expect(await sh.ok('git describe --abbrev=0')).toBe('v1.0\n');
    expect(await sh.ok('git describe --abbrev=10')).toBe(`v1.0-2-g${head.slice(0, 10)}\n`);
    expect(await sh.ok('git describe --exact-match HEAD~2')).toBe('v1.0\n');
    expect(await sh.run('git describe --exact-match')).toBe(`fatal: no tag exactly matches '${head}'\nExit code: 128`);
  });

  it('only uses lightweight tags with --tags', async () => {
    await sh.git.tag({ dir, ref: 'light', object: root });
    expect(await sh.run('git describe')).toBe(
      `fatal: No annotated tags can describe '${head}'.\nHowever, there were unannotated tags: try --tags.\nExit code: 128`,
    );
    expect(await sh.ok('git describe --tags')).toBe(`light-2-g${head.slice(0, 7)}\n`);

    await sh.git.tag({ dir, ref: 'newer', object: head });
    expect(await sh.ok('git describe --tags')).toBe('newer\n');
    expect(await sh.ok('git describe --tags --match "l*"')).toBe(`light-2-g${head.slice(0, 7)}\n`);
    expect(await sh.ok('git describe --all')).toBe('tags/newer\n');
    await sh.git.deleteRef({ dir, ref: 'refs/tags/newer' });
    expect(await sh.ok('git describe --all')).toBe('heads/main\n');
  });

  it('prefers annotated tags on the same commit', async () => {
    await sh.git.tag({ dir, ref: 'light', object: head });
    await sh.git.annotatedTag({ dir, ref: 'v2', message: 'v2', tagger, object: head });
    expect(await sh.ok('git describe --tags')).toBe('v2\n');
  });

  it('marks a dirty working tree', async () => {
    await sh.git.annotatedTag({ dir, ref: 'v1.0', message: 'v1', tagger, object: head });
    expect(await sh.ok('git describe --dirty')).toBe('v1.0\n');
    await sh.ok('echo d >> a.txt');
    expect(await sh.ok('git describe --dirty')).toBe('v1.0-dirty\n');
    expect(await sh.ok('git describe --dirty=.mod')).toBe('v1.0.mod\n');
    expect(await sh.run('git describe --dirty HEAD')).toBe("fatal: option '--dirty' and commit-ishes cannot be used together\nExit code: 128");
  });

  it('reports unreachable tags', async () => {
    await sh.git.annotatedTag({ dir, ref: 'v1.0', message: 'v1', tagger, object: head });
    await sh.ok('git checkout -q --orphan other && git commit -qm orphan');
    const orphan = (await sh.ok('git rev-parse HEAD')).trim();
    expect(await sh.run('git describe')).toBe(`fatal: No tags can describe '${orphan}'.\nTry --always, or create some tags.\nExit code: 128`);
  });
});
