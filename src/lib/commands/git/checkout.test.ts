import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git checkout', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && mkdir src && echo x > src/x.ts && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && echo y > src/y.ts && git add -A && git commit -qm second');
    await sh.ok('echo c >> a.txt && git commit -qam third');
  });

  afterEach(() => sh.dispose());

  it('detaches HEAD at a short hash with git\'s advice', async () => {
    const hash = (await sh.ok('git rev-parse --short HEAD~2')).trim();
    const out = await sh.ok(`git checkout ${hash}`);
    expect(out).toContain(`Note: switching to '${hash}'.\n\nYou are in 'detached HEAD' state.`);
    expect(out).toContain(`HEAD is now at ${hash} first\n`);
    expect(await sh.read('a.txt')).toBe('a\n');
    expect(await sh.ok('git ls-files')).toBe('a.txt\nsrc/x.ts\n');

    expect(await sh.ok('git checkout main')).toBe(`Previous HEAD position was ${hash} first\nSwitched to branch 'main'\n`);
    expect(await sh.read('a.txt')).toBe('a\nb\nc\n');
  });

  it('creates branches with -b and -B, and goes back with -', async () => {
    expect(await sh.ok('git checkout -b feat')).toBe("Switched to a new branch 'feat'\n");
    expect(await sh.run('git checkout -b feat')).toBe("fatal: a branch named 'feat' already exists\nExit code: 128");
    expect(await sh.ok('git checkout -B feat HEAD~1')).toBe("Reset branch 'feat'\n");
    expect(await sh.read('a.txt')).toBe('a\nb\n');
    expect(await sh.ok('git checkout -B other main~2')).toBe("Switched to a new branch 'other'\n");
    expect(await sh.ok('git checkout -')).toBe("Switched to branch 'feat'\n");
    expect(await sh.ok('git checkout -')).toBe("Switched to branch 'other'\n");
    expect(await sh.run('git checkout -b x nope')).toBe("fatal: 'nope' is not a commit and a branch 'x' cannot be created from it\nExit code: 128");
  });

  it('carries local changes over and refuses to overwrite them', async () => {
    await sh.ok('git checkout -q -b feat');
    await sh.ok('echo local >> src/x.ts');
    expect(await sh.ok('git checkout main')).toBe("M\tsrc/x.ts\nSwitched to branch 'main'\n");
    expect(await sh.read('src/x.ts')).toBe('x\nlocal\n');

    await sh.ok('echo dirty >> a.txt');
    expect(await sh.run('git checkout HEAD~1')).toBe(
      'error: Your local changes to the following files would be overwritten by checkout:\n\ta.txt\n' +
      'Please commit your changes or stash them before you switch branches.\nAborting\nExit code: 1',
    );
    await sh.ok('git checkout -q -f HEAD~1');
    expect(await sh.read('a.txt')).toBe('a\nb\n');
    expect(await sh.ok('git status -s')).toBe('(no output)');
  });

  it('removes files missing from the target and restores them on the way back', async () => {
    await sh.ok('git checkout -q HEAD~2');
    expect(await sh.run('cat src/y.ts')).toMatch(/No such file/);
    await sh.ok('git checkout -q main');
    expect(await sh.read('src/y.ts')).toBe('y\n');
  });

  it('restores files from a commit into the index and working tree', async () => {
    await sh.ok('git checkout HEAD~2 -- a.txt');
    expect(await sh.read('a.txt')).toBe('a\n');
    expect(await sh.ok('git status -s')).toBe('M  a.txt\n');
    expect(await sh.ok('git checkout HEAD a.txt')).toMatch(/^Updated 1 path from [0-9a-f]{7}\n$/);
    expect(await sh.ok('git status -s')).toBe('(no output)');
  });

  it('restores files from the index', async () => {
    await sh.ok('echo junk > a.txt && rm src/x.ts');
    expect(await sh.ok('git checkout .')).toBe('Updated 2 paths from the index\n');
    expect(await sh.ok('git status -s')).toBe('(no output)');
    await sh.ok('echo junk > a.txt');
    expect(await sh.ok('git checkout -- a.txt')).toBe('(no output)');
    expect(await sh.read('a.txt')).toBe('a\nb\nc\n');
  });

  it('reports unknown pathspecs and references', async () => {
    expect(await sh.run('git checkout nope')).toBe("error: pathspec 'nope' did not match any file(s) known to git\nExit code: 1");
    expect(await sh.run('git checkout -- nope')).toBe("error: pathspec 'nope' did not match any file(s) known to git\nExit code: 1");
    expect(await sh.run('git checkout nope -- a.txt')).toBe('fatal: invalid reference: nope\nExit code: 128');
    expect(await sh.run('git checkout HEAD~2 src/y.ts')).toBe("error: pathspec 'src/y.ts' did not match any file(s) known to git\nExit code: 1");
  });

  it('accepts HEAD~N and tags', async () => {
    await sh.ok('git tag v1 HEAD~1');
    await sh.ok('git checkout -q v1');
    expect(await sh.read('a.txt')).toBe('a\nb\n');
    expect(await sh.ok('git status')).toMatch(/^HEAD detached at v1\n/);
    expect(await sh.ok('git checkout -q main')).toBe('(no output)');
  });

  it('refuses to overwrite untracked files', async () => {
    await sh.ok('git checkout -q HEAD~2 && echo mine > src/y.ts');
    expect(await sh.run('git checkout main')).toBe(
      'error: The following untracked working tree files would be overwritten by checkout:\n\tsrc/y.ts\n' +
      'Please move or remove them before you switch branches.\nAborting\nExit code: 1',
    );
  });

  it('says interactive patch mode is unsupported', async () => {
    expect(await sh.run('git checkout -p a.txt')).toMatch(/not supported[\s\S]*Exit code: 128/);
  });
});
