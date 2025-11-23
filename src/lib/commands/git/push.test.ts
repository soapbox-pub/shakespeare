import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitPushCommand } from './push';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

describe('GitPushCommand', () => {
  let pushCommand: GitPushCommand;
  let mockGit: Partial<Git>;
  let mockFS: Partial<JSRuntimeFS>;
  const mockPwd = '/test-repo';

  beforeEach(() => {
    // Mock the filesystem
    mockFS = {
      stat: vi.fn().mockResolvedValue({}),
    };

    // Mock Git methods
    mockGit = {
      currentBranch: vi.fn().mockResolvedValue('main'),
      listRemotes: vi.fn().mockResolvedValue([]),
      push: vi.fn().mockResolvedValue(undefined),
    };

    pushCommand = new GitPushCommand({
      git: mockGit as Git,
      fs: mockFS as JSRuntimeFS,
    });
  });

  it('should fail when not in a git repository', async () => {
    const mockFSNoRepo: Partial<JSRuntimeFS> = {
      stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
    };

    const cmd = new GitPushCommand({
      git: mockGit as Git,
      fs: mockFSNoRepo as JSRuntimeFS,
    });

    const result = await cmd.execute(['origin', 'main'], mockPwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('not a git repository');
  });

  it('should fail when no remote is configured', async () => {
    const result = await pushCommand.execute(['origin', 'main'], mockPwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('does not appear to be a git repository');
  });

  it('should pass force flag to git.push when --force is used', async () => {
    // Configure a mock remote
    mockGit.listRemotes = vi.fn().mockResolvedValue([
      { remote: 'origin', url: 'https://example.com/repo.git' },
    ]);

    await pushCommand.execute(['origin', 'main', '--force'], mockPwd);

    // Verify that git.push was called with force: true
    expect(mockGit.push).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
      })
    );
  });

  it('should pass force flag to git.push when -f is used', async () => {
    // Configure a mock remote
    mockGit.listRemotes = vi.fn().mockResolvedValue([
      { remote: 'origin', url: 'https://example.com/repo.git' },
    ]);

    await pushCommand.execute(['origin', 'main', '-f'], mockPwd);

    // Verify that git.push was called with force: true
    expect(mockGit.push).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
      })
    );
  });

  it('should not pass force flag when not specified', async () => {
    // Configure a mock remote
    mockGit.listRemotes = vi.fn().mockResolvedValue([
      { remote: 'origin', url: 'https://example.com/repo.git' },
    ]);

    await pushCommand.execute(['origin', 'main'], mockPwd);

    // Verify that git.push was called with force: false
    expect(mockGit.push).toHaveBeenCalledWith(
      expect.objectContaining({
        force: false,
      })
    );
  });
});
