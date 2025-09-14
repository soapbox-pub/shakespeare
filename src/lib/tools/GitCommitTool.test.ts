import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitCommitTool } from './GitCommitTool';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock the Git class
const mockGitInstance = {
  statusMatrix: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  commit: vi.fn(),
  currentBranch: vi.fn(),
  getConfig: vi.fn(),
};

vi.mock('../git', () => ({
  Git: vi.fn().mockImplementation(() => mockGitInstance),
}));

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
    mockGitInstance.statusMatrix.mockResolvedValue([
      ['src/file1.ts', 1, 1, 0], // Modified file (present in head and workdir, but not staged)
      ['src/file2.ts', 0, 1, 0], // New file (absent in head, present in workdir, not staged)
    ]);
    mockGitInstance.add.mockResolvedValue(undefined);
    mockGitInstance.remove.mockResolvedValue(undefined);
    mockGitInstance.commit.mockResolvedValue('abcd1234567890abcdef1234567890abcdef12');
    mockGitInstance.currentBranch.mockResolvedValue('main');
    mockGitInstance.getConfig.mockRejectedValue(new Error('Config not found'));
  });

  it('should have correct description and inputSchema', () => {
    expect(tool.description).toBe('Commit changes to git with a commit message. Automatically adds all unstaged files.');
    expect(tool.inputSchema).toBeDefined();
  });

  it('should successfully commit changes', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await tool.execute({ message: 'Add new feature' });

    expect(mockFS.stat).toHaveBeenCalledWith('/test/project/.git');
    expect(mockGitInstance.statusMatrix).toHaveBeenCalledWith({
      dir: '/test/project',
    });
    expect(mockGitInstance.add).toHaveBeenCalled();
    expect(mockGitInstance.commit).toHaveBeenCalledWith({
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
    expect(result).toContain('✅ Successfully committed 2 files (abcd123)');
    expect(result).toContain('Add new feature');
  });

  it('should handle empty commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    await expect(tool.execute({ message: '' })).rejects.toThrow('❌ Commit message cannot be empty');
  });

  it('should handle whitespace-only commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    await expect(tool.execute({ message: '   ' })).rejects.toThrow('❌ Commit message cannot be empty');
  });

  it('should handle not being in a git repository', async () => {
    // Mock .git directory does not exist
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('File not found'));

    await expect(tool.execute({ message: 'Test commit' })).rejects.toThrow('❌ Not a git repository');
    expect(mockFS.stat).toHaveBeenCalledWith('/test/project/.git');
  });

  it('should handle commit with special characters in message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const specialMessage = 'Fix: handle "quotes" and \'apostrophes\' in commit message';
    const result = await tool.execute({ message: specialMessage });

    expect(mockGitInstance.commit).toHaveBeenCalledWith(expect.objectContaining({
      message: specialMessage,
    }));
    expect(result).toContain('✅ Successfully committed');
    expect(result).toContain(specialMessage);
  });

  it('should handle multiline commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const multilineMessage = 'Add new feature\n\nThis commit adds a new feature that allows users to do something amazing.\n\nCloses #123';
    const result = await tool.execute({ message: multilineMessage });

    expect(mockGitInstance.commit).toHaveBeenCalled();
    expect(result).toContain('✅ Successfully committed');
    expect(result).toContain('Add new feature');
  });

  it('should handle no changes to commit', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    // Mock no changes in status matrix
    vi.mocked(mockGitInstance.statusMatrix).mockResolvedValue([]);

    const result = await tool.execute({ message: 'Update documentation' });

    expect(result).toContain('ℹ️ No changes to commit. Working tree is clean.');
    expect(mockGitInstance.commit).not.toHaveBeenCalled();
  });

  it('should provide detailed commit information', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const result = await tool.execute({ message: 'Update documentation' });

    expect(result).toContain('📝 Commit: "Update documentation"');
    expect(result).toContain('🔗 Hash:');
    expect(result).toContain('🌿 Branch:');
    expect(result).toContain('📊 Changes:');
  });

  it('should use git config when available', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    // Mock git config
    vi.mocked(mockGitInstance.getConfig)
      .mockResolvedValueOnce('John Doe') // user.name
      .mockResolvedValueOnce('john@example.com'); // user.email

    const result = await tool.execute({ message: 'Test commit' });

    expect(mockGitInstance.commit).toHaveBeenCalledWith({
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
    expect(result).toContain('✅ Successfully committed');
  });

  it('should handle very long commit message', async () => {
    // Mock .git directory exists
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    const longMessage = 'A'.repeat(1000); // Very long commit message
    const result = await tool.execute({ message: longMessage });

    expect(result).toContain('✅ Successfully committed');
  });
});