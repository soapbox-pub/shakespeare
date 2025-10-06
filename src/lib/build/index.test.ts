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
          path: '/stdin-abc123.js',
          contents: new Uint8Array([1, 2, 3]),
          text: '',
          hash: 'abc123',
        },
        {
          path: '/stdin-def456.css',
          contents: new Uint8Array([4, 5, 6]),
          text: 'body { margin: 0; }',
          hash: 'def456',
        },
      ],
      metafile: {
        outputs: {
          'stdin-abc123.js': {
            entryPoint: 'fs:/test/project/src/main.tsx',
          },
          'stdin-def456.css': {
            entryPoint: undefined,
          },
        },
      },
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
        querySelector: vi.fn((selector: string) => {
          if (selector === 'meta[http-equiv="content-security-policy"]') {
            // Return null for CSP meta tag (no CSP present in test)
            return null;
          }
          return {
            setAttribute: vi.fn(),
            getAttribute: vi.fn(),
          };
        }),
        scripts: [
          {
            getAttribute: vi.fn((attr: string) => {
              if (attr === 'src') return '/src/main.tsx';
              return null;
            }),
            type: 'module',
          },
        ],
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

    // Should include built files with hashed names
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // CSS should be embedded in HTML, not as separate file
    expect(Object.keys(result.files)).not.toContain('stdin-def456.css');

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

    // Should still include built files with hashed names
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // CSS should be embedded in HTML, not as separate file
    expect(Object.keys(result.files)).not.toContain('stdin-def456.css');

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

    // Should include built files with hashed names
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // CSS should be embedded in HTML, not as separate file
    expect(Object.keys(result.files)).not.toContain('stdin-def456.css');

    // Should have exactly 2 files (stdin-abc123.js, index.html)
    expect(Object.keys(result.files)).toHaveLength(2);

    // Should try to copy public files but directory is empty
    expect(copyFiles).toHaveBeenCalledWith(mockFS, mockFS, '/test/project/public', '/test/project/dist');
  });

  it('should support yarn.lock when package-lock.json is missing', async () => {
    const yarnLock = `
# yarn lockfile v1

react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
  integrity sha512-...
  dependencies:
    loose-envify "^1.1.0"
`;

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
          throw new Error('File not found: package-lock.json');
        }
        if (path.endsWith('yarn.lock')) {
          return yarnLock;
        }
        throw new Error(`File not found: ${path}`);
      });

    // Mock stat to indicate no public directory
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

    // Should successfully build with yarn.lock
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // Verify yarn.lock was read
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/yarn.lock', 'utf8');
  });

  it('should work with no lock file at all', async () => {
    // Mock required files
    vi.mocked(mockFS.readFile)
      .mockImplementation(async (path: string) => {
        if (path.endsWith('package.json')) {
          return '{"name": "test-project"}';
        }
        if (path.endsWith('index.html')) {
          return '<html><head></head><body><script src="/src/main.tsx"></script></body></html>';
        }
        if (path.endsWith('package-lock.json') || path.endsWith('yarn.lock')) {
          throw new Error('File not found');
        }
        throw new Error(`File not found: ${path}`);
      });

    // Mock stat to indicate no public directory
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

    // Should successfully build with empty packages object
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // Verify both lock files were attempted to be read
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/package-lock.json', 'utf8');
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/yarn.lock', 'utf8');
  });

  it('should use package.json dependencies as fallback when no lock file exists', async () => {
    const packageJsonWithDeps = JSON.stringify({
      name: "test-project",
      dependencies: {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      }
    });

    // Mock required files
    vi.mocked(mockFS.readFile)
      .mockImplementation(async (path: string) => {
        if (path.endsWith('package.json')) {
          return packageJsonWithDeps;
        }
        if (path.endsWith('index.html')) {
          return '<html><head></head><body><script src="/src/main.tsx"></script></body></html>';
        }
        if (path.endsWith('package-lock.json') || path.endsWith('yarn.lock')) {
          throw new Error('File not found');
        }
        throw new Error(`File not found: ${path}`);
      });

    // Mock stat to indicate no public directory
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

    // Should successfully build using package.json dependencies
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // Verify package.json was read
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/package.json', 'utf8');
  });

  it('should read tsconfig.json when available', async () => {
    const tsconfigContent = JSON.stringify({
      compilerOptions: {
        baseUrl: "./src",
        paths: {
          "@/*": ["*"]
        }
      }
    });

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
        if (path.endsWith('tsconfig.json')) {
          return tsconfigContent;
        }
        throw new Error(`File not found: ${path}`);
      });

    // Mock stat to indicate no public directory
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

    // Should successfully build with tsconfig.json
    expect(result.files['stdin-abc123.js']).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.files['index.html']).toBeDefined();

    // Verify tsconfig.json was attempted to be read
    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/tsconfig.json', 'utf8');
  });
});