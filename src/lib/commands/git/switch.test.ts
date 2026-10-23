import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git switch', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && echo a > a.txt && git add -A && git commit -qm first');
    await sh.ok('echo b >> a.txt && git commit -qam second');
  });

  afterEach(() => sh.dispose());

  it('creates, switches and resets branches', async () => {
    expect(await sh.ok('git switch -c feat')).toBe("Switched to a new branch 'feat'\n");
    expect(await sh.ok('git switch main')).toBe("Switched to branch 'main'\n");
    expect(await sh.ok('git switch main')).toBe("Already on 'main'\n");
    expect(await sh.ok('git switch -C feat HEAD~1')).toBe("Switched to and reset branch 'feat'\n");
    expect(await sh.read('a.txt')).toBe('a\n');
    expect(await sh.ok('git switch -')).toBe("Switched to branch 'main'\n");
  });

  it('requires --detach for commits', async () => {
    expect(await sh.run('git switch HEAD~1')).toBe(
      "fatal: a branch is expected, got commit 'HEAD~1'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.\nExit code: 128",
    );
    expect(await sh.ok('git switch --detach HEAD~1')).toMatch(/^HEAD is now at [0-9a-f]{7} first\n$/);
    expect(await sh.ok('git switch -')).toMatch(/^Previous HEAD position was [0-9a-f]{7} first\nSwitched to branch 'main'\n$/);
  });

  it('reports unknown references', async () => {
    expect(await sh.run('git switch nope')).toBe('fatal: invalid reference: nope\nExit code: 128');
    expect(await sh.run('git switch -c x nope')).toBe('fatal: invalid reference: nope\nExit code: 128');
    expect(await sh.run('git switch')).toBe('fatal: missing branch or commit argument\nExit code: 128');
  });

  it('protects local changes unless forced', async () => {
    await sh.ok('git switch -q -c feat HEAD~1 && git switch -q main && echo dirty >> a.txt');
    expect(await sh.run('git switch feat')).toMatch(/would be overwritten by checkout:\n\ta.txt\n[\s\S]*Exit code: 1/);
    await sh.ok('git switch -q --discard-changes feat');
    expect(await sh.read('a.txt')).toBe('a\n');
  });

  it('creates a tracking branch from a remote-tracking one', async () => {
    await sh.ok('git remote add origin https://example.com/r.git && mkdir -p .git/refs/remotes/origin && git rev-parse HEAD~1 > .git/refs/remotes/origin/topic');
    expect(await sh.ok('git switch topic')).toBe(
      "branch 'topic' set up to track 'origin/topic'.\nSwitched to a new branch 'topic'\nYour branch is up to date with 'origin/topic'.\n",
    );
  });
});
