import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git init', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
  });
  afterEach(() => sh.dispose());

  it('initializes and reinitializes', async () => {
    expect(await sh.ok('git init')).toBe('Initialized empty Git repository in /projects/repo/.git/\n');
    expect(await sh.read('.git/HEAD')).toBe('ref: refs/heads/main\n');
    expect(await sh.ok('git init')).toBe('Reinitialized existing Git repository in /projects/repo/.git/\n');
    expect(await sh.ok('git init -q')).toBe('(no output)');
  });

  it('takes an initial branch and a directory', async () => {
    expect(await sh.ok('git init -b dev sub')).toBe('Initialized empty Git repository in /projects/repo/sub/.git/\n');
    expect(await sh.read('sub/.git/HEAD')).toBe('ref: refs/heads/dev\n');
    await sh.ok('git init -q --initial-branch=trunk ../other');
    expect(await sh.read('/projects/other/.git/HEAD')).toBe('ref: refs/heads/trunk\n');
  });
});
