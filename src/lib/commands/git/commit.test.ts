import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitCommitCommand } from './commit';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

describe('GitCommitCommand', () => {
  let commitCommand: GitCommitCommand;
  let mockGit: Partial<Git>;
  let mockFS: Partial<JSRuntimeFS>;
  const mockPwd = '/projects/test';

  beforeEach(() => {
    // Mock the filesystem
    mockFS = {
      stat: vi.fn().mockResolvedValue({}),
    };

    // Mock Git methods
    mockGit = {
      statusMatrix: vi.fn().mockResolvedValue([
        // filepath, HEAD status, workdir status, stage status
        ['file1.txt', 1, 2, 1], // modified in workdir
        ['file2.txt', 1, 1, 2], // modified in index
        ['file3.txt', 0, 2, 2], // new file
        ['file4.txt', 1, 0, 1], // deleted file
      ]),
      
      currentBranch: vi.fn().mockResolvedValue('main'),
      
      resolveRef: vi.fn().mockResolvedValue('headcommit'),
      
      log: vi.fn().mockResolvedValue([
        {
          oid: 'headcommit',
          commit: {
            message: 'Previous commit',
            parent: ['parentcommit'],
            tree: 'tree1',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600000000,
            },
          },
        },
        {
          oid: 'parentcommit',
          commit: {
            message: 'Parent commit',
            parent: [],
            tree: 'tree2',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1599000000,
            },
          },
        },
      ]),
      
      getConfig: vi.fn().mockImplementation(({ path }) => {
        if (path === 'user.name') return Promise.resolve('Test User');
        if (path === 'user.email') return Promise.resolve('test@example.com');
        return Promise.resolve(null);
      }),
      
      commit: vi.fn().mockResolvedValue('newcommit'),
      
      add: vi.fn().mockResolvedValue(undefined),
      
      remove: vi.fn().mockResolvedValue(undefined),
    };

    // Create the command instance with mocks
    commitCommand = new GitCommitCommand({
      git: mockGit as Git,
      fs: mockFS as JSRuntimeFS,
    });
  });

  it('should commit with a message', async () => {
    const result = await commitCommand.execute(['-m', 'Test commit'], mockPwd);
    
    expect(mockGit.commit).toHaveBeenCalledWith(expect.objectContaining({
      dir: mockPwd,
      message: 'Test commit',
    }));
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Test commit');
  });

  it('should fail without a message', async () => {
    const result = await commitCommand.execute([], mockPwd);
    
    expect(mockGit.commit).not.toHaveBeenCalled();
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Aborting commit due to empty commit message');
  });

  it('should handle --amend flag', async () => {
    const result = await commitCommand.execute(['--amend', '-m', 'Amended commit'], mockPwd);
    
    expect(mockGit.log).toHaveBeenCalledWith({
      dir: mockPwd,
      depth: 2,
    });
    
    expect(mockGit.commit).toHaveBeenCalledWith(expect.objectContaining({
      dir: mockPwd,
      message: 'Amended commit',
      parent: ['parentcommit'],
    }));
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Amended commit');
  });

  it('should handle --amend flag without message', async () => {
    const result = await commitCommand.execute(['--amend'], mockPwd);
    
    expect(mockGit.log).toHaveBeenCalledWith({
      dir: mockPwd,
      depth: 1,
    });
    
    expect(mockGit.commit).toHaveBeenCalledWith(expect.objectContaining({
      dir: mockPwd,
      message: 'Previous commit',
    }));
    
    expect(result.exitCode).toBe(0);
  });

  it('should handle -a flag to stage all tracked modified files', async () => {
    const result = await commitCommand.execute(['-a', '-m', 'Commit with auto-stage'], mockPwd);
    
    // Should call add for the modified tracked file
    expect(mockGit.add).toHaveBeenCalledWith({
      dir: mockPwd,
      filepath: 'file1.txt',
    });
    
    // Should not call add for already staged files
    expect(mockGit.add).not.toHaveBeenCalledWith({
      dir: mockPwd,
      filepath: 'file2.txt',
    });
    
    // Should call remove for deleted files
    expect(mockGit.remove).toHaveBeenCalledWith({
      dir: mockPwd,
      filepath: 'file4.txt',
    });
    
    expect(mockGit.commit).toHaveBeenCalledWith(expect.objectContaining({
      dir: mockPwd,
      message: 'Commit with auto-stage',
    }));
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Commit with auto-stage');
  });

  it('should handle -am flag for combined auto-stage and message', async () => {
    const result = await commitCommand.execute(['-am', 'Combined flag commit'], mockPwd);
    
    // Should call add for the modified tracked file
    expect(mockGit.add).toHaveBeenCalledWith({
      dir: mockPwd,
      filepath: 'file1.txt',
    });
    
    // Should call remove for deleted files
    expect(mockGit.remove).toHaveBeenCalledWith({
      dir: mockPwd,
      filepath: 'file4.txt',
    });
    
    expect(mockGit.commit).toHaveBeenCalledWith(expect.objectContaining({
      dir: mockPwd,
      message: 'Combined flag commit',
    }));
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Combined flag commit');
  });

  it('should handle --allow-empty flag', async () => {
    // Mock empty status
    mockGit.statusMatrix = vi.fn().mockResolvedValue([]);
    
    const result = await commitCommand.execute(['--allow-empty', '-m', 'Empty commit'], mockPwd);
    
    expect(mockGit.commit).toHaveBeenCalledWith(expect.objectContaining({
      dir: mockPwd,
      message: 'Empty commit',
    }));
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Empty commit');
  });

  it('should fail if there are no staged changes', async () => {
    // Mock status with only unstaged changes
    mockGit.statusMatrix = vi.fn().mockResolvedValue([
      ['file1.txt', 1, 2, 1], // modified in workdir only
    ]);
    
    const result = await commitCommand.execute(['-m', 'Should fail'], mockPwd);
    
    expect(mockGit.commit).not.toHaveBeenCalled();
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('nothing to commit');
  });

  it('should handle not being in a git repository', async () => {
    mockFS.stat = vi.fn().mockRejectedValue(new Error('Not a directory'));
    
    const result = await commitCommand.execute(['-m', 'Test commit'], mockPwd);
    
    expect(mockGit.commit).not.toHaveBeenCalled();
    
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('not a git repository');
  });
});
