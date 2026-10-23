import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitShell, type GitShell } from '@/test/gitShell';

describe('git remote', () => {
  let sh: GitShell;

  beforeEach(async () => {
    sh = await createGitShell();
    await sh.ok('git init -q && git remote add origin https://example.com/r.git');
  });
  afterEach(() => sh.dispose());

  it('lists, gets and sets urls', async () => {
    expect(await sh.ok('git remote')).toBe('origin\n');
    expect(await sh.ok('git remote -v')).toBe('origin\thttps://example.com/r.git (fetch)\norigin\thttps://example.com/r.git (push)\n');
    await sh.ok('git remote set-url origin nostr://npub1abc/repo');
    expect(await sh.ok('git remote get-url origin')).toBe('nostr://npub1abc/repo\n');
    await sh.ok('git remote set-url --push origin https://push.example/r.git');
    expect(await sh.ok('git remote -v')).toBe('origin\tnostr://npub1abc/repo (fetch)\norigin\thttps://push.example/r.git (push)\n');
  });

  it('renames and removes remotes with their refs and branch config', async () => {
    await sh.ok('echo a > a && git add a && git commit -qm i');
    const head = (await sh.ok('git rev-parse HEAD')).trim();
    await sh.git.writeRef({ dir: '/projects/repo', ref: 'refs/remotes/origin/main', value: head });
    await sh.ok('git branch -u origin/main');
    await sh.ok('git remote rename origin up');
    expect(await sh.ok('git remote')).toBe('up\n');
    expect(await sh.ok('git branch -r')).toBe('  up/main\n');
    expect(await sh.ok('git config branch.main.remote')).toBe('up\n');
    expect(await sh.ok('git remote show up')).toContain('* remote up\n  Fetch URL: https://example.com/r.git\n');
    await sh.ok('git remote rm up');
    expect(await sh.ok('git remote')).toBe('(no output)');
    expect(await sh.ok('git branch -r')).toBe('(no output)');
  });

  it('reports errors like git', async () => {
    expect(await sh.run('git remote add origin x')).toBe('error: remote origin already exists.\nExit code: 3');
    expect(await sh.run('git remote remove nope')).toBe("error: No such remote: 'nope'\nExit code: 2");
    expect(await sh.run('git remote get-url nope')).toBe("error: No such remote 'nope'\nExit code: 2");
    expect(await sh.run('git remote frob')).toContain("error: unknown subcommand: `frob'");
  });
});
