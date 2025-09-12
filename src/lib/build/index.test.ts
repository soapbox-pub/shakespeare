import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildProject } from './index';
import { copyFiles } from '../copyFiles';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock esbuild
vi.mock('../esbuild', () => ({
  getEsbuild: vi.fn(() => ({
    build: vi.fn(() => ({
      outputFiles: [
        {
          path: '/stdin.js',
          contents: new Uint8Array([1, 2, 3]),
        },
        {
          path: '/stdin.css',
          contents: new Uint8Array([4, 5, 6]),
        },
      ],
    })),
  })),
}));

// Mock copyFiles
vi.mock('../copyFiles', () => ({
  copyFiles: vi.fn(),
}));

describe('buildProject', () => {
  let mockFS: JSRuntimeFS;
  let mockDOMParser: DOMParser;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFS = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      mkdir: vi.fn(),
      unlink: vi.fn(),
      rmdir: vi.fn(),
      rename: vi.fn(),
      lstat: vi.fn(),
      readlink: vi.fn(),
      symlink: vi.fn(),
    } as JSRuntimeFS;

    mockDOMParser = {
      parseFromString: vi.fn(() => ({
        documentElement: {
          outerHTML: '<html><head></head><body><script src="/src/main.tsx"></script></body></html>',
        },
        querySelector: vi.fn(() => ({
          setAttribute: vi.fn(),
        })),
        head: {
          appendChild: vi.fn(),
        },
        createElement: vi.fn(() => ({
          setAttribute: vi.fn(),
        })),
      })),
    } as unknown as DOMParser;
  });

  it('should include files from public directory in build output', async () => {
    // Mock required files
    vi.mocked(mockFS.readFile)
      .mockImplementation(async (path: string) => {
        if (path.endsWith('package.json')) {
          return '{"name": "test-project"}';
        }
        if (path.endsWith('index.html')) {
          return '<html><head></head><body><script src="/src/main.tsx"></script></body></html>';
        }
        if (path.endsWith('package-lock.json')) {
          return '{"dependencies": {}}';
        }
        if (path === '/test/project/public/favicon.ico') {
          return new Uint8Array([10, 11, 12]);
        }
        if (path === '/test/project/public/images/logo.png') {
          return new Uint8Array([20, 21, 22]);
        }
        throw new Error(`Unexpected file read: ${path}`);
      });

    // Mock public directory structure
    vi.mocked(mockFS.stat)
      .mockImplementation(async (path: string) => {
        if (path === '/test/project/public') {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (path === '/test/project/public/images') {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isDirectory: () => false, isFile: () => true };
      });

    vi.mocked(mockFS.readdir)
      .mockImplementation(async (path: string, _options?: { withFileTypes: true }) => {
        if (path === '/test/project/public') {
          return [
            { name: 'favicon.ico', isDirectory: () => false, isFile: () => true },
            { name: 'images', isDirectory: () => true, isFile: () => false },
          ];
        }
        if (path === '/test/project/public/images') {
          return [
            { name: 'logo.png', isDirectory: () => false, isFile: () => true },
          ];
        }
        return [];
      });

    // Mock additional filesystem operations for buildProject
    vi.mocked(mockFS.readdir).mockImplementation(async (path: string) => {
      // Handle regular readdir calls for dist cleanup
      if (path === '/test/project/dist') {
        return [];
      }
      return [];
    });

    vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    const result = await buildProject({
      fs: mockFS,
      projectPath: '/test/project',
      domParser: mockDOMParser,
    });

    // Should include built files
    expect(result.files['main.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['main.css']).toEqual(new Uint8Array([4, 5, 6]));
    expect(result.files['index.html']).toBeDefined();

    // Public files should be copied to filesystem, not included in files object
    // Verify copyFiles was called for public directory
    expect(mockFS.stat).toHaveBeenCalledWith('/test/project/public');
    expect(copyFiles).toHaveBeenCalledWith(mockFS, mockFS, '/test/project/public', '/test/project/dist');

    // Should have correct metadata
    expect(result.outputPath).toBe('/test/project/dist');
    expect(result.projectId).toBe('project');
  });

  it('should handle missing public directory gracefully', async () => {
    // Mock required files
    vi.mocked(mockFS.readFile)
      .mockImplementation(async (path: string) => {
        if (path.endsWith('package.json')) {
          return '{"name": "test-project"}';
        }
        if (path.endsWith('index.html')) {
          return '<html><head></head><body><script src="/src/main.tsx"></script></body></html>';
        }
        if (path.endsWith('package-lock.json')) {
          return '{"dependencies": {}}';
        }
        throw new Error(`File not found: ${path}`);
      });

    // Mock missing public directory
    vi.mocked(mockFS.stat)
      .mockImplementation(async (path: string) => {
        if (path === '/test/project/public') {
          throw new Error('Directory not found');
        }
        return { isDirectory: () => false, isFile: () => true };
      });

    // Mock additional filesystem operations for buildProject
    vi.mocked(mockFS.readdir).mockImplementation(async (path: string) => {
      if (path === '/test/project/dist') {
        return [];
      }
      return [];
    });

    vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    const result = await buildProject({
      fs: mockFS,
      projectPath: '/test/project',
      domParser: mockDOMParser,
    });

    // Should still include built files
    expect(result.files['main.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['main.css']).toEqual(new Uint8Array([4, 5, 6]));
    expect(result.files['index.html']).toBeDefined();

    // Should not include any public files in bundle
    expect(Object.keys(result.files)).not.toContain('favicon.ico');

    // Should not try to copy public files if directory doesn't exist
    expect(copyFiles).not.toHaveBeenCalled();
  });

  it('should handle empty public directory', async () => {
    // Mock required files
    vi.mocked(mockFS.readFile)
      .mockImplementation(async (path: string) => {
        if (path.endsWith('package.json')) {
          return '{"name": "test-project"}';
        }
        if (path.endsWith('index.html')) {
          return '<html><head></head><body><script src="/src/main.tsx"></script></body></html>';
        }
        if (path.endsWith('package-lock.json')) {
          return '{"dependencies": {}}';
        }
        throw new Error(`File not found: ${path}`);
      });

    // Mock empty public directory
    vi.mocked(mockFS.stat)
      .mockImplementation(async (path: string) => {
        if (path === '/test/project/public') {
          return { isDirectory: () => true, isFile: () => false };
        }
        return { isDirectory: () => false, isFile: () => true };
      });

    vi.mocked(mockFS.readdir)
      .mockImplementation(async (path: string) => {
        // Handle regular readdir calls for dist cleanup
        if (path === '/test/project/dist') {
          return [];
        }
        return [];
      });

    // Mock additional filesystem operations for buildProject
    vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);
    vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

    const result = await buildProject({
      fs: mockFS,
      projectPath: '/test/project',
      domParser: mockDOMParser,
    });

    // Should include built files
    expect(result.files['main.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['main.css']).toEqual(new Uint8Array([4, 5, 6]));
    expect(result.files['index.html']).toBeDefined();

    // Should have exactly 3 files (main.js, main.css, index.html)
    expect(Object.keys(result.files)).toHaveLength(3);

    // Should try to copy public files but directory is empty
    expect(copyFiles).toHaveBeenCalledWith(mockFS, mockFS, '/test/project/public', '/test/project/dist');
  });
});