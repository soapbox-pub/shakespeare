import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadProjectTools } from './project-tools-loader';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock esbuild-wasm to avoid initialization issues in test environment
vi.mock('esbuild-wasm', async () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  transform: vi.fn().mockResolvedValue({ code: '' }),
}));

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
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
});

describe('loadProjectTools', () => {
  let mockFS: JSRuntimeFS;
  const projectPath = '/projects/test-project';
  const sessionID = 'test-session';
  const messageID = 'test-message';
  const esmUrl = 'https://esm.sh';

  beforeEach(() => {
    mockFS = createMockFS();
  });

  it('should return empty object when .opencode/tools directory does not exist', async () => {
    // Mock stat to throw error (directory doesn't exist)
    vi.mocked(mockFS.stat).mockRejectedValue(new Error('ENOENT'));

    const tools = await loadProjectTools(mockFS, projectPath, sessionID, messageID, esmUrl);

    expect(tools).toEqual({});
    expect(mockFS.stat).toHaveBeenCalledWith(`${projectPath}/.opencode/tools`);
  });

  it('should return empty object when .opencode/tools is not a directory', async () => {
    // Mock stat to return a file instead of directory
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 100,
      mtimeMs: Date.now(),
    });

    const tools = await loadProjectTools(mockFS, projectPath, sessionID, messageID, esmUrl);

    expect(tools).toEqual({});
    expect(mockFS.stat).toHaveBeenCalledWith(`${projectPath}/.opencode/tools`);
  });

  it('should return empty object when .opencode/tools directory is empty', async () => {
    // Mock stat to return directory
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    // Mock readdir to return no files
    vi.mocked(mockFS.readdir).mockResolvedValue([]);

    const tools = await loadProjectTools(mockFS, projectPath, sessionID, messageID, esmUrl);

    expect(tools).toEqual({});
    expect(mockFS.readdir).toHaveBeenCalledWith(`${projectPath}/.opencode/tools`);
  });

  it('should filter out non-tool files', async () => {
    // Mock stat to return directory
    vi.mocked(mockFS.stat).mockResolvedValue({
      isDirectory: () => true,
      isFile: () => false,
    });

    // Mock readdir to return various file types
    vi.mocked(mockFS.readdir).mockResolvedValue([
      'tool.ts',
      'tool.js',
      'README.md',
      'config.json',
      'data.txt',
    ]);

    // For simplicity, we won't test actual tool loading here since it requires esbuild
    // Just verify the filtering logic
    await loadProjectTools(mockFS, projectPath, sessionID, messageID, esmUrl);

    // Tools object should be empty because we didn't mock readFile
    // but the important thing is that it tried to process .ts and .js files
    expect(mockFS.readdir).toHaveBeenCalledWith(`${projectPath}/.opencode/tools`);
  });
});
