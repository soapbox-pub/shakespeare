import { describe, it, expect, beforeEach } from 'vitest';
import { MockFS } from '@/test/MockFS';
import { Git } from '@/lib/git';
import { GitLogCommand } from './log';
import { NPool } from '@nostrify/nostrify';

describe('GitLogCommand', () => {
  let fs: MockFS;
  let git: Git;
  let logCommand: GitLogCommand;

  beforeEach(async () => {
    fs = new MockFS();
    git = new Git({
      fs,
      nostr: new NPool(),
    });
    logCommand = new GitLogCommand({ git, fs });

    // Initialize a git repository
    await git.init({ dir: '/test-repo' });

    // Configure git
    await git.setConfig({ dir: '/test-repo', path: 'user.name', value: 'Test User' });
    await git.setConfig({ dir: '/test-repo', path: 'user.email', value: 'test@example.com' });

    // Create some commits
    await fs.writeFile('/test-repo/file1.txt', 'content 1');
    await git.add({ dir: '/test-repo', filepath: 'file1.txt' });
    await git.commit({
      dir: '/test-repo',
      message: 'First commit',
    });

    await fs.writeFile('/test-repo/file2.txt', 'content 2');
    await git.add({ dir: '/test-repo', filepath: 'file2.txt' });
    await git.commit({
      dir: '/test-repo',
      message: 'Second commit',
    });

    await fs.writeFile('/test-repo/file3.txt', 'content 3');
    await git.add({ dir: '/test-repo', filepath: 'file3.txt' });
    await git.commit({
      dir: '/test-repo',
      message: 'Third commit',
    });
  });

  it('should show all commits by default (no limit)', async () => {
    const result = await logCommand.execute([], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('First commit');
    expect(result.stdout).toContain('Second commit');
    expect(result.stdout).toContain('Third commit');
  });

  it('should limit commits with -n flag', async () => {
    const result = await logCommand.execute(['-n', '1'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Third commit');
    expect(result.stdout).not.toContain('Second commit');
    expect(result.stdout).not.toContain('First commit');
  });

  it('should limit commits with -n= syntax', async () => {
    const result = await logCommand.execute(['-n=2'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Third commit');
    expect(result.stdout).toContain('Second commit');
    expect(result.stdout).not.toContain('First commit');
  });

  it('should limit commits with --max-count flag', async () => {
    const result = await logCommand.execute(['--max-count', '2'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Third commit');
    expect(result.stdout).toContain('Second commit');
    expect(result.stdout).not.toContain('First commit');
  });

  it('should limit commits with -<number> syntax', async () => {
    const result = await logCommand.execute(['-2'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Third commit');
    expect(result.stdout).toContain('Second commit');
    expect(result.stdout).not.toContain('First commit');
  });

  it('should format with --oneline', async () => {
    const result = await logCommand.execute(['--oneline'], '/test-repo');
    expect(result.exitCode).toBe(0);
    // Oneline format should have short hash and message on same line
    const lines = result.stdout.trim().split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^[0-9a-f]{7} Third commit$/);
    expect(lines[1]).toMatch(/^[0-9a-f]{7} Second commit$/);
    expect(lines[2]).toMatch(/^[0-9a-f]{7} First commit$/);
  });

  it('should format with --format=oneline', async () => {
    const result = await logCommand.execute(['--format=oneline'], '/test-repo');
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toMatch(/^[0-9a-f]{7} Third commit$/);
  });

  it('should format with --format=short', async () => {
    const result = await logCommand.execute(['--format=short'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('commit');
    expect(result.stdout).toContain('Author:');
    expect(result.stdout).not.toContain('Date:'); // Short format doesn't include date
  });

  it('should format with --format=full', async () => {
    const result = await logCommand.execute(['--format=full'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('commit');
    expect(result.stdout).toContain('Author:');
    expect(result.stdout).toContain('Date:');
  });

  it('should format with --format=fuller', async () => {
    const result = await logCommand.execute(['--format=fuller'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('commit');
    expect(result.stdout).toContain('Author:');
    expect(result.stdout).toContain('AuthorDate:');
  });

  it('should format with --format=raw', async () => {
    const result = await logCommand.execute(['--format=raw'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('commit');
    expect(result.stdout).toContain('author');
    expect(result.stdout).toMatch(/author .+ <.+> \d+ \+0000/);
  });

  it('should show graph with --graph', async () => {
    const result = await logCommand.execute(['--graph', '--oneline'], '/test-repo');
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines[0]).toMatch(/^\* [0-9a-f]{7} Third commit$/);
  });

  it('should combine --graph with full format', async () => {
    const result = await logCommand.execute(['--graph'], '/test-repo');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('* commit');
  });

  it('should error when not in a git repository', async () => {
    const result = await logCommand.execute([], '/not-a-repo');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a git repository');
  });

  it('should show more than 50 commits when no limit is specified', async () => {
    // Create 60 commits
    for (let i = 4; i <= 60; i++) {
      await fs.writeFile(`/test-repo/file${i}.txt`, `content ${i}`);
      await git.add({ dir: '/test-repo', filepath: `file${i}.txt` });
      await git.commit({
        dir: '/test-repo',
        message: `Commit ${i}`,
      });
    }

    const result = await logCommand.execute(['--oneline'], '/test-repo');
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines.length).toBe(60); // Should show all 60 commits, not just 50
    expect(result.stdout).toContain('Commit 60');
    expect(result.stdout).toContain('Commit 1');
  });

  it('should respect limit even with many commits', async () => {
    // Create 60 commits
    for (let i = 4; i <= 60; i++) {
      await fs.writeFile(`/test-repo/file${i}.txt`, `content ${i}`);
      await git.add({ dir: '/test-repo', filepath: `file${i}.txt` });
      await git.commit({
        dir: '/test-repo',
        message: `Commit ${i}`,
      });
    }

    const result = await logCommand.execute(['-10', '--oneline'], '/test-repo');
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines.length).toBe(10); // Should show only 10 commits
    expect(result.stdout).toContain('Commit 60');
    expect(result.stdout).not.toContain('Commit 1');
  });
});
