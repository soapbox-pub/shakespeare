import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git branch', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && git add . && git commit -qm first && echo b >> a.txt && git commit -qam second');
  });
  afterEach(() => sh.dispose());

  it('lists, creates from any revision, and shows details with -v', async () => {
    await sh.ok('git branch old HEAD~1');
    const short = (await sh.ok('git rev-parse --short HEAD~1')).trim();
    await sh.ok(`git branch fromhash ${short}`);
    expect(await sh.ok('git branch')).toBe('  fromhash\n* main\n  old\n');
    expect(await sh.ok('git branch -v')).toMatch(/^ {2}fromhash [0-9a-f]{7} first\n\* main {5}[0-9a-f]{7} second\n {2}old {6}[0-9a-f]{7} first\n$/);
    expect(await sh.ok('git branch --show-current')).toBe('main\n');
    expect(await sh.ok("git branch --list 'o*'")).toBe('  old\n');
    expect(await sh.ok('git branch --merged old')).toBe('  fromhash\n  old\n');
    expect(await sh.ok('git branch --contains HEAD')).toBe('* main\n');
    expect(await sh.ok("git branch --format='%(refname:short)'")).toBe('fromhash\nmain\nold\n');
  });

  it('shows a detached HEAD', async () => {
    await sh.ok('git checkout -q HEAD~1');
    const short = (await sh.ok('git rev-parse --short HEAD')).trim();
    expect(await sh.ok('git branch')).toBe(`* (HEAD detached at ${short})\n  main\n`);
    expect(await sh.ok('git branch --show-current')).toBe('(no output)');
  });

  it('reports errors like git', async () => {
    await sh.ok('git branch x');
    expect(await sh.run('git branch x')).toBe("fatal: a branch named 'x' already exists\nExit code: 128");
    await sh.ok('git branch -f x HEAD~1');
    expect(await sh.run('git branch nb nosuch')).toBe("fatal: not a valid object name: 'nosuch'\nExit code: 128");
    expect(await sh.run("git branch 'bad..name'")).toContain("fatal: 'bad..name' is not a valid branch name");
    expect(await sh.run('git branch -d nonexist')).toBe("error: branch 'nonexist' not found\nExit code: 1");
    expect(await sh.run('git branch -d main')).toContain("error: cannot delete branch 'main' used by worktree at");
  });

  it('refuses to delete unmerged branches unless forced', async () => {
    await sh.ok('git checkout -qb side && echo s > s.txt && git add . && git commit -qm side1 && git checkout -q main');
    expect(await sh.run('git branch -d side')).toBe("error: the branch 'side' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D side'\nExit code: 1");
    expect(await sh.ok('git branch -D side')).toMatch(/^Deleted branch side \(was [0-9a-f]{7}\)\.\n$/);
  });

  it('renames and copies, including the current branch', async () => {
    await sh.ok('git branch x && git branch -c x y && git branch -m y z && git branch -m trunk');
    expect(await sh.ok('git branch')).toBe('* trunk\n  x\n  z\n');
    expect(await sh.read('.git/HEAD')).toBe('ref: refs/heads/trunk\n');
    expect(await sh.run('git branch -m x z')).toContain("fatal: a branch named 'z' already exists");
    await sh.ok('git branch -M x z');
    expect(await sh.ok('git branch')).toBe('* trunk\n  z\n');
  });

  it('renames an unborn branch', async () => {
    const fresh = await createGitShell('/projects/new');
    await fresh.ok('git init -q && git branch -M trunk');
    expect(await fresh.read('.git/HEAD')).toBe('ref: refs/heads/trunk\n');
    fresh.dispose();
  });

  it('tracks upstreams', async () => {
    await sh.ok('git remote add origin https://example.com/r.git');
    const head = (await sh.ok('git rev-parse HEAD')).trim();
    await sh.git.writeRef({ dir: '/projects/repo', ref: 'refs/remotes/origin/main', value: head });
    expect(await sh.ok('git branch -u origin/main')).toBe("branch 'main' set up to track 'origin/main'.\n");
    await sh.ok('echo c >> a.txt && git commit -qam third');
    expect(await sh.ok('git branch -vv')).toMatch(/^\* main [0-9a-f]{7} \[origin\/main: ahead 1\] third\n$/);
    expect(await sh.ok('git branch -r')).toBe('  origin/main\n');
    expect(await sh.ok('git branch -a')).toBe('* main\n  remotes/origin/main\n');
    expect(await sh.ok('git branch feature origin/main')).toBe("branch 'feature' set up to track 'origin/main'.\n");
    await sh.ok('git branch --unset-upstream');
    expect(await sh.run('git config branch.main.remote')).toContain('Exit code: 1');
  });
});
