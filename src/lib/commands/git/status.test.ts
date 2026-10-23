import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git status', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && echo y > src/y.ts && git add -A && git commit -qm first');
  });

  afterEach(() => sh.dispose());

  it('reports a clean tree', async () => {
    expect(await sh.ok('git status')).toBe('On branch main\nnothing to commit, working tree clean\n');
    expect(await sh.ok('git status -s')).toBe('(no output)');
  });

  it('prints the long format with sections, hints and collapsed untracked directories', async () => {
    await sh.ok('echo new > new.txt && git add new.txt && echo mod >> a.txt && rm src/x.ts');
    await sh.ok('mkdir -p untr/deep && echo u > untr/deep/u.txt && echo t > top.txt');
    expect(await sh.ok('git status')).toBe(
      'On branch main\n' +
      'Changes to be committed:\n' +
      '  (use "git restore --staged <file>..." to unstage)\n' +
      '\tnew file:   new.txt\n' +
      '\n' +
      'Changes not staged for commit:\n' +
      '  (use "git add/rm <file>..." to update what will be committed)\n' +
      '  (use "git restore <file>..." to discard changes in working directory)\n' +
      '\tmodified:   a.txt\n' +
      '\tdeleted:    src/x.ts\n' +
      '\n' +
      'Untracked files:\n' +
      '  (use "git add <file>..." to include in what will be committed)\n' +
      '\ttop.txt\n' +
      '\tuntr/\n' +
      '\n',
    );
  });

  it('prints short and porcelain formats', async () => {
    await sh.ok('echo new > new.txt && git add new.txt && echo mod >> a.txt && git add a.txt && echo more >> a.txt');
    await sh.ok('mkdir -p untr/deep && echo u > untr/deep/u.txt');
    expect(await sh.ok('git status -s')).toBe('MM a.txt\nA  new.txt\n?? untr/\n');
    expect(await sh.ok('git status --porcelain -b')).toBe('## main\nMM a.txt\nA  new.txt\n?? untr/\n');
    expect(await sh.ok('git status -s -uall')).toBe('MM a.txt\nA  new.txt\n?? untr/deep/u.txt\n');
    expect(await sh.ok('git status -s -uno')).toBe('MM a.txt\nA  new.txt\n');
    expect(await sh.ok('git status -s src untr')).toBe('?? untr/\n');
  });

  it('shows staged renames', async () => {
    await sh.ok('git mv a.txt b.txt');
    expect(await sh.ok('git status -s')).toBe('R  a.txt -> b.txt\n');
    expect(await sh.ok('git status')).toContain('\trenamed:    a.txt -> b.txt\n');
  });

  it('lists ignored files with --ignored', async () => {
    await sh.ok('echo "dist/" > .gitignore && mkdir dist && echo d > dist/app.js && git add .gitignore && git commit -qm ignore');
    expect(await sh.ok('git status -s')).toBe('(no output)');
    expect(await sh.ok('git status -s --ignored')).toBe('!! dist/\n');
  });

  it('describes a repository with no commits', async () => {
    await sh.ok('mkdir /projects/empty');
    const run = (cmd: string) => sh.ok(`cd /projects/empty && ${cmd}`);
    await run('git init -q');
    expect(await run('git status')).toBe('On branch main\n\nNo commits yet\n\nnothing to commit (create/copy files and use "git add" to track)\n');
    await run('echo a > a && git add a');
    expect(await run('git status')).toContain('Changes to be committed:\n  (use "git rm --cached <file>..." to unstage)\n\tnew file:   a\n');
    expect(await run('git status -sb')).toBe('## No commits yet on main\nA  a\n');
  });

  it('reports ahead/behind against the upstream', async () => {
    await sh.ok('git remote add origin https://example.com/r.git && git config branch.main.remote origin && git config branch.main.merge refs/heads/main');
    await sh.ok('mkdir -p .git/refs/remotes/origin && git rev-parse HEAD > .git/refs/remotes/origin/main');
    await sh.ok('echo b >> a.txt && git commit -qam second');
    expect(await sh.ok('git status')).toBe(
      "On branch main\nYour branch is ahead of 'origin/main' by 1 commit.\n  (use \"git push\" to publish your local commits)\n\nnothing to commit, working tree clean\n",
    );
    expect(await sh.ok('git status -sb')).toBe('## main...origin/main [ahead 1]\n');
  });

  it('notices a same-size edit made right after staging', async () => {
    await sh.ok('echo 1 > n.txt && git add n.txt && echo 2 > n.txt');
    expect(await sh.ok('git status -s')).toBe('AM n.txt\n');
  });

  it('names a detached HEAD', async () => {
    await sh.ok('echo b >> a.txt && git commit -qam second && git checkout -q HEAD~1');
    expect(await sh.ok('git status')).toMatch(/^HEAD detached at [0-9a-f]{7}\nnothing to commit, working tree clean\n$/);
    expect(await sh.ok('git status -sb')).toBe('## HEAD (no branch)\n');
  });

  it('rejects unknown options', async () => {
    expect(await sh.run('git status --bogus')).toMatch(/error: unknown option `bogus'[\s\S]*Exit code: 129/);
  });
});
