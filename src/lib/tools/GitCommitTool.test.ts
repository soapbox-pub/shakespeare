import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitCommitTool } from './GitCommitTool';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock isomorphic-git
vi.mock('isomorphic-git', () => ({
  default: {
    statusMatrix: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    commit: vi.fn(),
    currentBranch: vi.fn(),
    getConfig: vi.fn(),
  },
}));

import git from 'isomorphic-git';

// Mock filesystem
const mockFS: JSRuntimeFS = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  lstat: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
  rename: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
};

describe('GitCommitTool', () => {
  let tool: GitCommitTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GitCommitTool(mockFS, '/test/project');

    // Setup default mocks
    vi.mocked(git.statusMatrix).mockResolvedValue([
      ['src/file1.ts', 1, 1, 0], // Modified file (present in head and workdir, but not staged)
      ['src/file2.ts', 0, 1, 0], // New file (absent in head, present in workdir, not staged)
    ]);
    vi.mocked(git.add).mockResolvedValue();
    vi.mocked(git.commit).mockResolvedValue('abcd1234567890abcdef1234567890abcdef12');
    vi.mocked(git.currentBranch).mockResolvedValue('main');
    vi.mocked(git.getConfig).mockRejectedValue(new Error('Config not found'));
  });

  it('should have correct description and parameters', () => {
    expect(tool.description).toBe('Commit changes to git with a commit message. Automatically adds all unstaged files.');
    expect(tool.parameters).toBeDefined();
  });

  it('should successfully commit changes', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await tool.execute({ message: 'Add new feature' });

    expect(mockFS.stat).toHaveBeenCalledWith('/test/project/.git');
    expect(git.statusMatrix).toHaveBeenCalledWith({
      fs: mockFS,
      dir: '/test/project',
    });
    expect(git.add).toHaveBeenCalled();
    expect(git.commit).toHaveBeenCalledWith({
      fs: mockFS,
      dir: '/test/project',
      message: 'Add new feature',
      author: {
        name: 'shakespeare.diy',
        email: 'assistant@shakespeare.diy',
      },
      committer: {
        name: 'shakespeare.diy',
        email: 'assistant@shakespeare.diy',
      },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Successfully committed 2 files (abcd123)');
    expect(result.content[0].text).toContain('Add new feature');
  });

  it('should handle empty commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await tool.execute({ message: '' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Commit message cannot be empty');
  });

  it('should handle whitespace-only commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await tool.execute({ message: '   ' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Commit message cannot be empty');
  });

  it('should handle not being in a git repository', async () => {
    // Mock .git directory does not exist
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('File not found'));

    const result = await tool.execute({ message: 'Test commit' });

    expect(mockFS.stat).toHaveBeenCalledWith('/test/project/.git');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Not a git repository');
    expect(result.content[0].text).toContain('git init');
  });

  it('should handle commit with special characters in message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const specialMessage = 'Fix: handle "quotes" and \'apostrophes\' in commit message';
    const result = await tool.execute({ message: specialMessage });

    expect(git.commit).toHaveBeenCalledWith(expect.objectContaining({
      message: specialMessage,
    }));
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Successfully committed');
    expect(result.content[0].text).toContain(specialMessage);
  });

  it('should handle multiline commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const multilineMessage = 'Add new feature\n\nThis commit adds a new feature that allows users to do something amazing.\n\nCloses #123';
    const result = await tool.execute({ message: multilineMessage });

    expect(git.commit).toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Successfully committed');
    expect(result.content[0].text).toContain('Add new feature');
  });

  it('should handle no changes to commit', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    // Mock no changes in status matrix
    vi.mocked(git.statusMatrix).mockResolvedValue([]);

    const result = await tool.execute({ message: 'Update documentation' });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('ℹ️ No changes to commit. Working tree is clean.');
    expect(git.commit).not.toHaveBeenCalled();
  });

  it('should provide detailed commit information', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await tool.execute({ message: 'Update documentation' });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('📝 Commit: "Update documentation"');
    expect(result.content[0].text).toContain('🔗 Hash:');
    expect(result.content[0].text).toContain('🌿 Branch:');
    expect(result.content[0].text).toContain('📊 Changes:');
  });

  it('should use git config when available', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    // Mock git config
    vi.mocked(git.getConfig)
      .mockResolvedValueOnce('John Doe') // user.name
      .mockResolvedValueOnce('john@example.com'); // user.email

    const result = await tool.execute({ message: 'Test commit' });

    expect(git.commit).toHaveBeenCalledWith({
      fs: mockFS,
      dir: '/test/project',
      message: 'Test commit',
      author: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      committer: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });
    expect(result.isError).toBe(false);
  });

  it('should handle very long commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const longMessage = 'A'.repeat(1000); // Very long commit message
    const result = await tool.execute({ message: longMessage });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Successfully committed');
  });
});