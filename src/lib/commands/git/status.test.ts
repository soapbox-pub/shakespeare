import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitStatusCommand } from './status';
import type { JSRuntimeFS } from '../../JSRuntime';
import type { Git } from '../../git';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn().mockResolvedValue('mock content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockImplementation((path: string) => {
    if (path.endsWith('/.git')) {
      return Promise.resolve({
        isDirectory: () => true,
        isFile: () => false,
        size: 0,
        mtimeMs: Date.now(),
      });
    }
    throw new Error('ENOENT: no such file or directory');
  }),
  lstat: vi.fn().mockResolvedValue({
    isDirectory: () => true,
    isFile: () => false,
    size: 0,
    mtimeMs: Date.now(),
  }),
  unlink: vi.fn().mockResolvedValue(undefined),
  rmdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readlink: vi.fn().mockResolvedValue('mock link'),
  symlink: vi.fn().mockResolvedValue(undefined),
});

// Mock Git
const createMockGit = (): Git => ({
  statusMatrix: vi.fn(),
  currentBranch: vi.fn(),
  stat: vi.fn(),
} as unknown as Git);

describe('GitStatusCommand', () => {
  let statusCommand: GitStatusCommand;
  let mockFS: JSRuntimeFS;
  let mockGit: Git;
  const testCwd = '/test';

  beforeEach(() => {
    mockFS = createMockFS();
    mockGit = createMockGit();
    statusCommand = new GitStatusCommand({
      git: mockGit,
      fs: mockFS,
    });
  });

  it('should have correct command properties', () => {
    expect(statusCommand.name).toBe('status');
    expect(statusCommand.description).toBe('Show the working tree status');
    expect(statusCommand.usage).toBe('git status [--porcelain] [--short]');
  });

  it('should return error when not in a git repository', async () => {
    // Mock stat to throw error for .git directory
    vi.mocked(mockFS.stat).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('fatal: not a git repository');
  });

  it('should show clean status when no changes', async () => {
    // Mock git status matrix with no changes
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('On branch main');
    expect(result.stdout).toContain('nothing to commit, working tree clean');
  });

  it('should show untracked files correctly', async () => {
    // Mock git status matrix with untracked file
    // [filepath, headStatus, workdirStatus, stageStatus]
    // Untracked: headStatus=0, stageStatus=0, workdirStatus=2
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['newfile.txt', 0, 2, 0]
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('On branch main');
    expect(result.stdout).toContain('Untracked files:');
    expect(result.stdout).toContain('newfile.txt');
  });

  it('should show staged files correctly', async () => {
    // Mock git status matrix with staged file
    // Staged new file: headStatus=0, stageStatus=2, workdirStatus=2
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['newfile.txt', 0, 2, 2]
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('On branch main');
    expect(result.stdout).toContain('Changes to be committed:');
    expect(result.stdout).toContain('new file:   newfile.txt');
  });

  it('should show modified files correctly', async () => {
    // Mock git status matrix with modified file
    // Modified file: headStatus=1, stageStatus=1, workdirStatus=2
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['existing.txt', 1, 2, 1]
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('On branch main');
    expect(result.stdout).toContain('Changes not staged for commit:');
    expect(result.stdout).toContain('modified:   existing.txt');
  });

  it('should show deleted files correctly', async () => {
    // Mock git status matrix with deleted file
    // Deleted file: headStatus=1, stageStatus=1, workdirStatus=0
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['deleted.txt', 1, 0, 1]
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('On branch main');
    expect(result.stdout).toContain('Changes not staged for commit:');
    expect(result.stdout).toContain('deleted:    deleted.txt');
  });

  it('should format porcelain output correctly', async () => {
    // Mock git status matrix with various changes
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['untracked.txt', 0, 2, 0],  // Untracked
      ['staged.txt', 0, 2, 2],     // Staged new file
      ['modified.txt', 1, 2, 1],   // Modified
      ['deleted.txt', 1, 0, 1],    // Deleted
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute(['--porcelain'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('?? untracked.txt');
    expect(result.stdout).toContain('A  staged.txt');
    expect(result.stdout).toContain(' M modified.txt');
    expect(result.stdout).toContain(' D deleted.txt');
  });

  it('should handle short format', async () => {
    // Mock git status matrix with changes
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['untracked.txt', 0, 2, 0],  // Untracked
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('main');

    const result = await statusCommand.execute(['--short'], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('?? untracked.txt');
  });

  it('should handle complex status matrix correctly', async () => {
    // Mock git status matrix with a complex scenario
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([
      ['file1.txt', 1, 2, 2],  // Modified and staged
      ['file2.txt', 0, 2, 0],  // Untracked
      ['file3.txt', 1, 0, 0],  // Deleted (staged)
      ['file4.txt', 1, 2, 1],  // Modified (not staged)
    ]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue('feature-branch');

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('On branch feature-branch');
    expect(result.stdout).toContain('Changes to be committed:');
    expect(result.stdout).toContain('modified:   file1.txt');
    expect(result.stdout).toContain('deleted:    file3.txt');
    expect(result.stdout).toContain('Untracked files:');
    expect(result.stdout).toContain('file2.txt');
    expect(result.stdout).toContain('Changes not staged for commit:');
    expect(result.stdout).toContain('modified:   file4.txt');
  });

  it('should handle detached HEAD state', async () => {
    // Mock git status matrix with no current branch
    vi.mocked(mockGit.statusMatrix).mockResolvedValue([]);
    vi.mocked(mockGit.currentBranch).mockResolvedValue(undefined);

    const result = await statusCommand.execute([], testCwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('HEAD detached at unknown');
    expect(result.stdout).toContain('nothing to commit, working tree clean');
  });
});