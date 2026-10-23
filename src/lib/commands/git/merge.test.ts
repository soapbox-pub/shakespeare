import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git merge', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok("git init -q && printf '1\\n2\\n3\\n' > a.txt && git add . && git commit -qm first");
  });
  afterEach(() => sh.dispose());

  it('fast-forwards with a stat', async () => {
    await sh.ok('git checkout -qb feat && echo 4 >> a.txt && echo n > new.txt && git add . && git commit -qm feat1 && git checkout -q main');
    const out = await sh.ok('git merge feat');
    expect(out).toMatch(/^Updating [0-9a-f]{7}\.\.[0-9a-f]{7}\nFast-forward\n a\.txt {3}\| 1 \+\n new\.txt \| 1 \+\n 2 files changed, 2 insertions\(\+\)\n create mode 100644 new\.txt\n$/);
    expect(await sh.read('new.txt')).toBe('n\n');
    expect(await sh.ok('git rev-parse main')).toBe(await sh.ok('git rev-parse feat'));
    expect(await sh.ok('git merge feat')).toBe('Already up to date.\n');
  });

  it('accepts any revision', async () => {
    await sh.ok('git checkout -qb feat && echo 4 >> a.txt && git commit -qam f1 && echo 5 >> a.txt && git commit -qam f2 && git checkout -q main');
    await sh.ok('git merge -q feat~1');
    expect(await sh.read('a.txt')).toBe('1\n2\n3\n4\n');
    expect(await sh.run('git merge nope')).toBe('merge: nope - not something we can merge\nExit code: 1');
  });

  it('makes merge commits, refuses --ff-only, and honours --no-ff', async () => {
    await sh.ok('git checkout -qb side && echo s > s.txt && git add . && git commit -qm side1 && git checkout -q main && echo 4 >> a.txt && git commit -qam main1');
    const refused = await sh.run('git merge --ff-only side');
    expect(refused).toContain('fatal: Not possible to fast-forward, aborting.');
    expect(refused).toContain('Exit code: 128');

    expect(await sh.ok('git merge --no-edit side')).toContain("Merge made by the 'ort' strategy.\n s.txt | 1 +\n");
    const parents = (await sh.ok('git log -1 --format=%P')).trim().split(' ');
    expect(parents).toHaveLength(2);
    expect(await sh.ok('git log -1 --format=%s')).toBe("Merge branch 'side'\n");

    await sh.ok('git checkout -qb ff && echo f > f.txt && git add . && git commit -qm ff1 && git checkout -q main');
    await sh.ok('git merge --no-ff -m "custom" ff');
    expect(await sh.ok('git log -1 --format=%s')).toBe('custom\n');
  });

  it('stops on conflicts with markers and state, then commits or aborts', async () => {
    await sh.ok('git checkout -qb c1 && echo X > a.txt && git commit -qam cx && git checkout -q main && echo Y > a.txt && git commit -qam cy');
    const out = await sh.run('git merge c1');
    expect(out).toBe('Auto-merging a.txt\nCONFLICT (content): Merge conflict in a.txt\nAutomatic merge failed; fix conflicts and then commit the result.\nExit code: 1');
    expect(await sh.read('a.txt')).toBe('<<<<<<< HEAD\nY\n=======\nX\n>>>>>>> c1\n');
    expect(await sh.read('.git/MERGE_MSG')).toBe("Merge branch 'c1'\n\n# Conflicts:\n#\ta.txt\n");
    expect((await sh.read('.git/MERGE_HEAD')).trim()).toBe((await sh.ok('git rev-parse c1')).trim());
    expect(await sh.run('git merge c1')).toContain('fatal: You have not concluded your merge (MERGE_HEAD exists).');

    await sh.ok('git merge --abort');
    expect(await sh.read('a.txt')).toBe('Y\n');
    expect(await sh.ok('git status --porcelain')).toBe('(no output)');
    expect(await sh.run('git merge --abort')).toContain('fatal: There is no merge to abort (MERGE_HEAD missing).');

    await sh.run('git merge c1');
    await sh.ok('echo Z > a.txt && git add a.txt && git commit -q --no-edit');
    expect((await sh.ok('git log -1 --format=%P')).trim().split(' ')).toHaveLength(2);
  });

  it('refuses to overwrite local changes', async () => {
    await sh.ok('git checkout -qb feat && echo 4 >> a.txt && git commit -qam f && git checkout -q main && echo local >> a.txt');
    const out = await sh.run('git merge feat');
    expect(out).toContain('error: Your local changes to the following files would be overwritten by merge:\n\ta.txt');
    expect(await sh.read('a.txt')).toBe('1\n2\n3\nlocal\n');
  });

  it('squashes without committing', async () => {
    await sh.ok('git checkout -qb sq && echo q > q.txt && git add . && git commit -qm sq1 && git checkout -q main && echo 4 >> a.txt && git commit -qam m');
    expect(await sh.ok('git merge --squash sq')).toContain('Squash commit -- not updating HEAD');
    expect(await sh.ok('git status --porcelain')).toBe('A  q.txt\n');
    expect(await sh.read('.git/MERGE_MSG')).toContain('Squashed commit of the following:');
  });
});
