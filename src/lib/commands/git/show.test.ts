import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitShowCommand } from './show';
import type { Git } from '../../git';
import type { JSRuntimeFS } from '../../JSRuntime';

describe('GitShowCommand', () => {
  let showCommand: GitShowCommand;
  let mockGit: Partial<Git>;
  let mockFS: Partial<JSRuntimeFS>;
  const mockPwd = '/projects/test';

  // Sample file contents for testing diffs
  const oldFileContent = 'line 1\nline 2\nline 3\nline 4\nline 5\n';
  const modifiedFileContent = 'line 1\nmodified line 2\nline 3\nnew line\nline 5\n';
  const binaryFileContent = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString();

  beforeEach(() => {
    // Mock the filesystem
    mockFS = {
      stat: vi.fn().mockResolvedValue({}),
    };

    // Mock Git methods with realistic behavior
    mockGit = {
      // Mock resolveRef to handle different references
      resolveRef: vi.fn().mockImplementation(async ({ ref }) => {
        switch (ref) {
          case 'HEAD':
            return 'merge-commit';
          case 'main':
            return 'merge-commit';
          case 'branch':
            return 'branch-commit';
          case 'initial-commit':
          case 'simple-commit':
          case 'merge-commit':
          case 'branch-commit':
            return ref;
          default:
            throw new Error(`Reference ${ref} does not exist`);
        }
      }),

      // Mock readCommit to return commit objects
      readCommit: vi.fn().mockImplementation(async ({ oid }) => {
        switch (oid) {
          case 'initial-commit':
            return {
              oid: 'initial-commit',
              commit: {
                message: 'Initial commit',
                parent: [],
                tree: 'initial-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600000000,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600000000,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            };
          case 'simple-commit':
            return {
              oid: 'simple-commit',
              commit: {
                message: 'Simple changes',
                parent: ['initial-commit'],
                tree: 'simple-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001000,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001000,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            };
          case 'branch-commit':
            return {
              oid: 'branch-commit',
              commit: {
                message: 'Branch commit',
                parent: ['initial-commit'],
                tree: 'branch-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001500,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001500,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            };
          case 'merge-commit':
            return {
              oid: 'merge-commit',
              commit: {
                message: 'Merge branch',
                parent: ['simple-commit', 'branch-commit'],
                tree: 'merge-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600002000,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600002000,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            };
          default:
            throw new Error(`Commit ${oid} not found`);
        }
      }),

      // Mock log to return commit history
      log: vi.fn().mockImplementation(async ({ ref }) => {
        switch (ref) {
          case 'initial-commit':
            return [{
              oid: 'initial-commit',
              commit: {
                message: 'Initial commit',
                parent: [],
                tree: 'initial-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600000000,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600000000,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            }];
          case 'simple-commit':
            return [{
              oid: 'simple-commit',
              commit: {
                message: 'Simple changes',
                parent: ['initial-commit'],
                tree: 'simple-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001000,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001000,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            }];
          case 'branch-commit':
            return [{
              oid: 'branch-commit',
              commit: {
                message: 'Branch commit',
                parent: ['initial-commit'],
                tree: 'branch-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001500,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600001500,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            }];
          case 'merge-commit':
            return [{
              oid: 'merge-commit',
              commit: {
                message: 'Merge branch',
                parent: ['simple-commit', 'branch-commit'],
                tree: 'merge-tree',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600002000,
                  timezoneOffset: 0,
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  timestamp: 1600002000,
                  timezoneOffset: 0,
                },
              },
              payload: '',
            }];
          default:
            return [];
        }
      }),

      // Mock readTree to return file trees
      readTree: vi.fn().mockImplementation(async ({ oid }) => {
        switch (oid) {
          case 'initial-tree':
            return {
              oid,
              tree: [
                { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-initial-1' },
                { path: 'file2.txt', mode: '100644', type: 'blob', oid: 'blob-initial-2' },
              ],
            };
          case 'simple-tree':
            return {
              oid,
              tree: [
                { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-modified-1' },
                { path: 'file2.txt', mode: '100644', type: 'blob', oid: 'blob-initial-2' },
                { path: 'file3.txt', mode: '100644', type: 'blob', oid: 'blob-new-3' },
              ],
            };
          case 'branch-tree':
            return {
              oid,
              tree: [
                { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-initial-1' },
                { path: 'file2.txt', mode: '100644', type: 'blob', oid: 'blob-branch-2' },
                { path: 'binary.bin', mode: '100644', type: 'blob', oid: 'blob-binary' },
              ],
            };
          case 'merge-tree':
            return {
              oid,
              tree: [
                { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-modified-1' },
                { path: 'file2.txt', mode: '100644', type: 'blob', oid: 'blob-branch-2' },
                { path: 'file3.txt', mode: '100644', type: 'blob', oid: 'blob-new-3' },
                { path: 'binary.bin', mode: '100644', type: 'blob', oid: 'blob-binary' },
              ],
            };
          case 'initial-commit':
          case 'simple-commit':
          case 'branch-commit':
          case 'merge-commit':
            // Handle the case when oid is actually a commit hash
            return {
              oid,
              tree: [
                { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-modified-1' },
                { path: 'file2.txt', mode: '100644', type: 'blob', oid: 'blob-initial-2' },
              ],
            };
          default:
            return { oid, tree: [] };
        }
      }),

      // Mock readBlob to return file contents
      readBlob: vi.fn().mockImplementation(async ({ filepath, oid }) => {
        // Return different content based on blob ID or filepath
        if (filepath === 'file1.txt') {
          if (oid.includes('initial') || oid === 'initial-commit') {
            return { blob: new TextEncoder().encode(oldFileContent), oid: 'blob-initial-1' };
          } else {
            return { blob: new TextEncoder().encode(modifiedFileContent), oid: 'blob-modified-1' };
          }
        } else if (filepath === 'file2.txt') {
          if (oid.includes('branch')) {
            return { blob: new TextEncoder().encode('file 2 branch content'), oid: 'blob-branch-2' };
          } else {
            return { blob: new TextEncoder().encode('file 2 content'), oid: 'blob-initial-2' };
          }
        } else if (filepath === 'file3.txt') {
          return { blob: new TextEncoder().encode('new file content'), oid: 'blob-new-3' };
        } else if (filepath === 'binary.bin') {
          return { blob: new TextEncoder().encode(binaryFileContent), oid: 'blob-binary' };
        }

        // Default case
        return { blob: new TextEncoder().encode('default content'), oid: 'default-blob' };
      }),
    };

    // Create the command instance with mocks
    showCommand = new GitShowCommand({
      git: mockGit as Git,
      fs: mockFS as JSRuntimeFS,
    });
  });

  it('should show basic commit information', async () => {
    const result = await showCommand.execute(['simple-commit'], mockPwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('commit simple-commit');
    expect(result.stdout).toContain('Author: Test User');
    expect(result.stdout).toContain('Simple changes');
  });

  it('should handle initial commits properly', async () => {
    const result = await showCommand.execute(['initial-commit'], mockPwd);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Initial commit');

    // The implementation should detect this is an initial commit
    expect(result.stdout).toContain('initial commit');
  });

  it('should resolve HEAD~1 correctly', async () => {
    // First, check that the implementation correctly resolves HEAD~1
    const result = await showCommand.execute(['HEAD~1'], mockPwd);

    // Verify that resolveRef was called with HEAD
    expect(mockGit.resolveRef).toHaveBeenCalledWith({
      dir: mockPwd,
      ref: 'HEAD',
    });

    // Verify that readCommit was called with the resolved HEAD commit
    expect(mockGit.readCommit).toHaveBeenCalledWith({
      dir: mockPwd,
      oid: 'merge-commit',
    });

    // Check that the result contains the parent commit info
    expect(result.stdout).toContain('Simple changes');
  });

  it('should resolve HEAD^2 correctly', async () => {
    const result = await showCommand.execute(['HEAD^2'], mockPwd);

    // Verify that resolveRef was called with HEAD
    expect(mockGit.resolveRef).toHaveBeenCalledWith({
      dir: mockPwd,
      ref: 'HEAD',
    });

    // Verify that readCommit was called with the resolved HEAD commit
    expect(mockGit.readCommit).toHaveBeenCalledWith({
      dir: mockPwd,
      oid: 'merge-commit',
    });

    // Check that the result contains the second parent commit info
    expect(result.stdout).toContain('Branch commit');
  });

  it('should show file changes between commits', async () => {
    // This test verifies that the diff output includes file changes
    // We need to ensure our mocks provide the necessary data for the diff algorithm

    // Reset the call counts
    vi.clearAllMocks();

    // Force the readTree mock to return different trees for parent and current commit
    vi.mocked(mockGit.readTree!).mockImplementation(async ({ oid }) => {
      if (oid === 'simple-commit' || oid === 'simple-tree') {
        return {
          oid,
          tree: [
            { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-modified-1' },
            { path: 'file3.txt', mode: '100644', type: 'blob', oid: 'blob-new-3' },
          ],
        };
      } else if (oid === 'initial-commit' || oid === 'initial-tree') {
        return {
          oid,
          tree: [
            { path: 'file1.txt', mode: '100644', type: 'blob', oid: 'blob-initial-1' },
            { path: 'file2.txt', mode: '100644', type: 'blob', oid: 'blob-initial-2' },
          ],
        };
      }
      return { oid, tree: [] };
    });

    // Execute the command
    const result = await showCommand.execute(['simple-commit'], mockPwd);

    // Check that the command output contains the commit message
    expect(result.stdout).toContain('Simple changes');

    // Verify that the necessary methods were called
    expect(mockGit.readTree).toHaveBeenCalled();

    // Check that the output mentions the files that were changed
    expect(result.stdout).toContain('file1.txt');
    expect(result.stdout).toContain('file3.txt');

    // Check for file status indicators
    expect(result.stdout).toContain('added');
    expect(result.stdout).toContain('modified');
  });

  it('should show line-by-line diffs with proper formatting', async () => {
    // Reset the call counts
    vi.clearAllMocks();

    // Set up specific file content for diffing
    const oldContent = 'line 1\nline 2\nline 3\nline 4\nline 5\n';
    const newContent = 'line 1\nmodified line 2\nline 3\nnew line\nline 5\n';

    // Mock log to return a commit with a parent
    vi.mocked(mockGit.log!).mockImplementation(async ({ ref }) => {
      if (ref === 'diff-test-commit') {
        return [{
          oid: 'diff-test-commit',
          commit: {
            message: 'Test diff formatting',
            parent: ['diff-parent-commit'],
            tree: 'diff-test-tree',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600001000,
              timezoneOffset: 0,
            },
            committer: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600001000,
              timezoneOffset: 0,
            },
          },
          payload: '',
        }];
      }
      return [];
    });

    // Mock readCommit for the parent commit
    vi.mocked(mockGit.readCommit!).mockImplementation(async ({ oid }) => {
      if (oid === 'diff-test-commit') {
        return {
          oid: 'diff-test-commit',
          commit: {
            message: 'Test diff formatting',
            parent: ['diff-parent-commit'],
            tree: 'diff-test-tree',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600001000,
              timezoneOffset: 0,
            },
            committer: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600001000,
              timezoneOffset: 0,
            },
          },
          payload: '',
        };
      } else if (oid === 'diff-parent-commit') {
        return {
          oid: 'diff-parent-commit',
          commit: {
            message: 'Parent commit',
            parent: [],
            tree: 'diff-parent-tree',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600000000,
              timezoneOffset: 0,
            },
            committer: {
              name: 'Test User',
              email: 'test@example.com',
              timestamp: 1600000000,
              timezoneOffset: 0,
            },
          },
          payload: '',
        };
      }
      throw new Error(`Commit ${oid} not found`);
    });

    // Force the readTree mock to return trees with different content
    vi.mocked(mockGit.readTree!).mockImplementation(async ({ oid }) => {
      if (oid === 'diff-test-tree') {
        return {
          oid,
          tree: [
            { path: 'diff-test.txt', mode: '100644', type: 'blob', oid: 'blob-new' },
          ],
        };
      } else if (oid === 'diff-parent-tree') {
        return {
          oid,
          tree: [
            { path: 'diff-test.txt', mode: '100644', type: 'blob', oid: 'blob-old' },
          ],
        };
      } else if (oid === 'diff-parent-commit') {
        return {
          oid,
          tree: [
            { path: 'diff-test.txt', mode: '100644', type: 'blob', oid: 'blob-old' },
          ],
        };
      } else if (oid === 'diff-test-commit') {
        return {
          oid,
          tree: [
            { path: 'diff-test.txt', mode: '100644', type: 'blob', oid: 'blob-new' },
          ],
        };
      }
      return { oid, tree: [] };
    });

    // Mock readBlob to return our test content
    vi.mocked(mockGit.readBlob!).mockImplementation(async ({ filepath, oid }) => {
      if (filepath === 'diff-test.txt') {
        if (oid === 'blob-old' || oid === 'diff-parent-commit' || oid === 'diff-parent-tree') {
          return { blob: new TextEncoder().encode(oldContent), oid: 'blob-old' };
        } else {
          return { blob: new TextEncoder().encode(newContent), oid: 'blob-new' };
        }
      }
      return { blob: new TextEncoder().encode('default content'), oid: 'default-blob' };
    });

    // Mock resolveRef to handle our test commit
    vi.mocked(mockGit.resolveRef!).mockImplementation(async ({ ref }) => {
      if (ref === 'diff-test-commit') {
        return 'diff-test-commit';
      }
      throw new Error(`Reference ${ref} does not exist`);
    });

    // Execute the command
    const result = await showCommand.execute(['diff-test-commit'], mockPwd);

    // Debug output
    console.log('Test output:', result.stdout);

    // Check for unified diff format with hunk headers
    expect(result.stdout).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);

    // Check for context lines (unchanged lines)
    expect(result.stdout).toContain(' line 1');
    expect(result.stdout).toContain(' line 3');
    expect(result.stdout).toContain(' line 5');

    // Check for removed lines (with - prefix)
    expect(result.stdout).toContain('-line 2');

    // Check for added lines (with + prefix)
    expect(result.stdout).toContain('+modified line 2');
    expect(result.stdout).toContain('+new line');

    // Verify that readBlob was called to get file contents for diffing
    expect(mockGit.readBlob).toHaveBeenCalled();
  });

  it('should return an error for invalid references', async () => {
    const result = await showCommand.execute(['non-existent-ref'], mockPwd);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('bad revision');
  });

  it('should return an error when not in a git repository', async () => {
    mockFS.stat = vi.fn().mockRejectedValue(new Error('Not a directory'));

    const result = await showCommand.execute([], mockPwd);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('not a git repository');
  });
});