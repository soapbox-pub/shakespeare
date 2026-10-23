import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git revert and cherry-pick', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && printf "1\\n2\\n3\\n4\\n5\\n6\\n7\\n8\\n" > n.txt && git add -A && git commit -qm base');
    await sh.ok('sed -i "s/^2$/two/" n.txt && git commit -qam "change two"');
    await sh.ok('sed -i "s/^7$/seven/" n.txt && echo extra > extra.txt && git add -A && git commit -qm "change seven"');
  });

  afterEach(() => sh.dispose());

  it('reverts an older commit by short hash, merging around later changes', async () => {
    const short = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    const out = await sh.ok(`git revert --no-edit ${short}`);
    expect(out).toMatch(/^\[main [0-9a-f]{7}\] Revert "change two"\n 1 file changed, 1 insertion\(\+\), 1 deletion\(-\)\n$/);
    expect(await sh.read('n.txt')).toBe('1\n2\n3\n4\n5\n6\nseven\n8\n');
    expect(await sh.ok('git log -1 --format=%B')).toMatch(/^Revert "change two"\n\nThis reverts commit [0-9a-f]{40}\.\n/);
    expect(await sh.ok('git status --short')).toBe('(no output)');
  });

  it('reverts additions and supports --no-commit', async () => {
    await sh.ok('git revert -n HEAD');
    expect(await sh.run('cat extra.txt')).toContain('No such file');
    expect(await sh.ok('git log -1 --format=%s')).toBe('change seven\n');
    expect(await sh.ok('git diff --cached --name-status')).toBe('D\textra.txt\nM\tn.txt\n');
  });

  it('stops on conflicts and continues or aborts', async () => {
    await sh.ok('sed -i "s/^two$/TWO/" n.txt && git commit -qam "shout two"');
    const out = await sh.run('git revert HEAD~2');
    expect(out).toContain('CONFLICT (content): Merge conflict in n.txt');
    expect(out).toContain('error: could not revert');
    expect(out).toContain('Exit code: 1');
    expect(await sh.read('n.txt')).toContain('<<<<<<< HEAD\nTWO\n=======\n2\n>>>>>>> parent of');

    await sh.ok('git revert --abort');
    expect(await sh.read('n.txt')).toContain('TWO');
    expect(await sh.ok('git status --short')).toBe('(no output)');

    await sh.run('git revert HEAD~2');
    await sh.ok('sed -i "/^[<=>]/d; /^TWO$/d" n.txt && git add n.txt');
    expect(await sh.ok('git revert --continue')).toContain('Revert "change two"');
    expect(await sh.ok('git log -1 --format=%s')).toBe('Revert "change two"\n');
  });

  it('refuses to overwrite local changes', async () => {
    await sh.ok('echo local >> n.txt');
    const out = await sh.run('git revert HEAD~1');
    expect(out).toContain('Your local changes to the following files would be overwritten by revert');
    expect(await sh.read('n.txt')).toContain('local');
  });

  it('cherry-picks commits from another branch, keeping author and adding -x', async () => {
    await sh.ok('git switch -q -c feature HEAD~2 && echo f > f.txt && git add f.txt && git commit -qm feat --author="Ada <ada@example.com>"');
    await sh.ok('git switch -q main');
    const out = await sh.ok('git cherry-pick -x feature');
    expect(out).toMatch(/^\[main [0-9a-f]{7}\] feat\n 1 file changed, 1 insertion\(\+\)\n create mode 100644 f\.txt\n$/);
    expect(await sh.ok('git log -1 --format="%an %s"')).toBe('Ada feat\n');
    expect(await sh.ok('git log -1 --format=%b')).toContain('(cherry picked from commit ');
    expect(await sh.read('f.txt')).toBe('f\n');
  });

  it('cherry-picks a range oldest first', async () => {
    await sh.ok('git switch -q -c feature HEAD~2 && echo 1 > f1 && git add f1 && git commit -qm f1 && echo 2 > f2 && git add f2 && git commit -qm f2');
    await sh.ok('git switch -q main && git cherry-pick main..feature');
    expect(await sh.ok('git log --format=%s -3')).toBe('f2\nf1\nchange seven\n');
  });
});
