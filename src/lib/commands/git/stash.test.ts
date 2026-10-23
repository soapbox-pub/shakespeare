import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git stash', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok("git init -q && printf '1\\n2\\n3\\n' > a.txt && echo b > b.txt && git add . && git commit -qm first");
  });
  afterEach(() => sh.dispose());

  it('says when there is nothing to stash', async () => {
    expect(await sh.ok('git stash')).toBe('No local changes to save\n');
  });

  it('stashes and pops tracked changes', async () => {
    await sh.ok('echo 4 >> a.txt && git rm -q b.txt && echo n > n.txt && git add n.txt');
    expect(await sh.ok('git stash')).toMatch(/^Saved working directory and index state WIP on main: [0-9a-f]{7} first\n$/);
    expect(await sh.ok('git status --porcelain')).toBe('(no output)');
    expect(await sh.read('b.txt')).toBe('b\n');
    expect(await sh.ok('git stash list')).toMatch(/^stash@\{0\}: WIP on main: [0-9a-f]{7} first\n$/);
    expect(await sh.ok('git stash show')).toContain('3 files changed, 2 insertions(+), 1 deletion(-)');

    const out = await sh.ok('git stash pop');
    expect(out).toMatch(/Dropped refs\/stash@\{0\} \([0-9a-f]{40}\)/);
    expect(await sh.read('a.txt')).toBe('1\n2\n3\n4\n');
    // New files come back staged; other changes unstaged.
    expect(await sh.ok('git status --porcelain')).toBe(' M a.txt\n D b.txt\nA  n.txt\n');
    expect(await sh.ok('git stash list')).toBe('(no output)');
  });

  it('keeps messages, indexes entries and drops by name', async () => {
    await sh.ok('echo x >> a.txt && git stash push -m "first msg"');
    await sh.ok('echo y >> b.txt && git stash -q');
    expect(await sh.ok('git stash list')).toMatch(/^stash@\{0\}: WIP on main: \w+ first\nstash@\{1\}: On main: first msg\n$/);
    expect(await sh.ok('git stash show -p stash@{1}')).toContain('+x');
    expect(await sh.run('git stash drop stash@{5}')).toContain("fatal: log for 'stash' only has 2 entries");
    expect(await sh.ok('git stash drop stash@{1}')).toMatch(/^Dropped stash@\{1\} \(\w{40}\)\n$/);
    await sh.ok('git stash apply -q');
    expect(await sh.read('b.txt')).toBe('b\ny\n');
    expect(await sh.ok('git stash list')).toContain('stash@{0}');
    await sh.ok('git stash clear');
    expect(await sh.run('git stash pop')).toBe('No stash entries found.\nExit code: 1');
  });

  it('stashes untracked files with -u and only given pathspecs', async () => {
    await sh.ok('echo u > u.txt && echo 4 >> a.txt && echo c >> b.txt');
    await sh.ok('git stash push -u -- u.txt a.txt');
    expect(await sh.ok('git status --porcelain')).toBe(' M b.txt\n');
    expect(await sh.ok('git stash show --include-untracked --name-only')).toBe('a.txt\nu.txt\n');
    await sh.ok('git checkout -- b.txt && git stash pop');
    expect(await sh.read('u.txt')).toBe('u\n');
    expect(await sh.ok('git status --porcelain')).toBe(' M a.txt\n?? u.txt\n');
  });

  it('restores the index with --index', async () => {
    await sh.ok('echo 4 >> a.txt && git add a.txt && echo c >> b.txt && git stash && git stash apply --index -q');
    expect(await sh.ok('git status --porcelain')).toBe('M  a.txt\n M b.txt\n');
  });

  it('keeps the entry when popping conflicts', async () => {
    await sh.ok("printf '1\\n2\\nstash\\n' > a.txt && git stash -q");
    await sh.ok("printf '1\\n2\\nhead\\n' > a.txt && git commit -qam head");
    const out = await sh.run('git stash pop');
    expect(out).toContain('CONFLICT (content): Merge conflict in a.txt');
    expect(out).toContain('The stash entry is kept in case you need it again.');
    expect(out).toContain('Exit code: 1');
    expect(await sh.read('a.txt')).toBe('1\n2\n<<<<<<< Updated upstream\nhead\n=======\nstash\n>>>>>>> Stashed changes\n');
    expect(await sh.ok('git stash list')).toContain('stash@{0}');
  });

  it('refuses to apply over local changes', async () => {
    await sh.ok('echo 4 >> a.txt && git stash -q && echo 5 >> a.txt');
    const out = await sh.run('git stash pop');
    expect(out).toContain('error: Your local changes to the following files would be overwritten by merge:\n\ta.txt');
    expect(out).toContain('Exit code: 1');
  });

  it('creates a branch from a stash', async () => {
    await sh.ok('echo 4 >> a.txt && git stash -q && echo 9 > b.txt && git commit -qam second');
    const out = await sh.ok('git stash branch fix');
    expect(out).toContain("Switched to a new branch 'fix'");
    expect(await sh.ok('git branch --show-current')).toBe('fix\n');
    expect(await sh.read('b.txt')).toBe('b\n');
    expect(await sh.read('a.txt')).toBe('1\n2\n3\n4\n');
    expect(await sh.ok('git stash list')).toBe('(no output)');
  });

  it('migrates stashes saved by the old implementation', async () => {
    await sh.fs.writeFile('/projects/repo/.git/shakespeare_stash.json', JSON.stringify([
      { message: 'WIP on main', branch: 'main', timestamp: Date.now(), files: [{ filepath: 'a.txt', content: 'old\n', status: 'modified' }], stagedFiles: [] },
    ]));
    expect(await sh.ok('git stash list')).toBe('stash@{0}: WIP on main\n');
    await sh.ok('git stash pop -q');
    expect(await sh.read('a.txt')).toBe('old\n');
  });

  it('writes stashes real git can read', async () => {
    await sh.ok('echo 4 >> a.txt && git stash -q');
    const oid = (await sh.ok('git rev-parse refs/stash')).trim();
    const { commit } = await sh.git.readCommit({ dir: '/projects/repo', oid });
    expect(commit.parent).toHaveLength(2);
    expect(await sh.fs.readFile('/projects/repo/.git/logs/refs/stash', 'utf8')).toMatch(/^0{40} [0-9a-f]{40} .+ <.+> \d+ [+-]\d{4}\tWIP on main: \w+ first\n$/);
  });
});
