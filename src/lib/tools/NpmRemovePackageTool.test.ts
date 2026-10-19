import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NpmRemovePackageTool } from './NpmRemovePackageTool';
import type { JSRuntimeFS } from '../JSRuntime';

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

/** Serve these files from mockFS; anything else doesn't exist. */
function mockFiles(files: Record<string, string>) {
  vi.mocked(mockFS.readFile).mockImplementation((async (path: string) => {
    if (!(path in files)) throw new Error(`ENOENT: ${path}`);
    return files[path];
  }) as typeof mockFS.readFile);
}

describe('NpmRemovePackageTool', () => {
  let tool: NpmRemovePackageTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new NpmRemovePackageTool(mockFS, '/test/project');
  });

  it('should have correct description and inputSchema', () => {
    expect(tool.description).toBe('Safely remove an npm package from the project in the current directory, updating package.json and the lockfile (package-lock.json or bun.lock).');
    expect(tool.inputSchema).toBeDefined();
  });

  it('should successfully remove package from dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21',
        'axios': '^1.0.0'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'lodash' });

    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/package.json', 'utf8');

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.dependencies.lodash).toBeUndefined();
    expect(writtenPackageJson.dependencies.axios).toBe('^1.0.0');
    expect(result.content).toContain('✅ Successfully removed lodash from dependencies');
  });

  it('should successfully remove package from devDependencies', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        'eslint': '^8.0.0'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'typescript' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.devDependencies.typescript).toBeUndefined();
    expect(writtenPackageJson.devDependencies.eslint).toBe('^8.0.0');
    expect(writtenPackageJson.dependencies.react).toBe('^18.0.0');
    expect(result.content).toContain('✅ Successfully removed typescript from devDependencies');
  });

  it('should remove empty dependencies object', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'lodash' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.dependencies).toBeUndefined();
    expect(result.content).toContain('✅ Successfully removed');
  });

  it('should remove empty devDependencies object', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0'
      },
      devDependencies: {
        'typescript': '^5.0.0'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'typescript' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.devDependencies).toBeUndefined();
    expect(writtenPackageJson.dependencies.react).toBe('^18.0.0');
    expect(result.content).toContain('✅ Successfully removed');
  });

  it('should handle package not found', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'nonexistent-package' });

    expect(mockFS.writeFile).not.toHaveBeenCalled();
    expect(result.content).toContain('ℹ️ Package nonexistent-package was not found');
  });

  it('should handle missing package.json', async () => {
    vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

    await expect(tool.execute({ name: 'lodash' })).rejects.toThrow('❌ Could not read package.json');
  });

  it('should handle invalid package.json', async () => {
    mockFiles({ "/test/project/package.json": "invalid json" });

    await expect(tool.execute({ name: 'lodash' })).rejects.toThrow('❌ Invalid package.json format');
  });

  it('should sort remaining dependencies alphabetically', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'zlib': '^1.0.0',
        'lodash': '^4.17.21',
        'axios': '^1.0.0'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'lodash' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);
    const dependencyKeys = Object.keys(writtenPackageJson.dependencies);

    expect(dependencyKeys).toEqual(['axios', 'zlib']);
    expect(result.content).toContain('✅ Successfully removed');
  });

  it('should include version information in success message', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    };

    mockFiles({ "/test/project/package.json": JSON.stringify(packageJson, null, 2) });

    const result = await tool.execute({ name: 'lodash' });

    expect(result.content).toContain('🏷️ Version: ^4.17.21');
    expect(result.content).toContain('📁 Removed from: dependencies');
  });

  it('should drop packages nothing needs any more from package-lock.json', async () => {
    const packageJson = { name: 'test-project', version: '1.0.0', dependencies: { a: '^1.0.0', b: '^1.0.0' } };
    mockFiles({
      '/test/project/package.json': JSON.stringify(packageJson, null, 2),
      '/test/project/package-lock.json': JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { name: 'test-project', version: '1.0.0', dependencies: packageJson.dependencies },
          'node_modules/a': { version: '1.0.0', dependencies: { shared: '^1.0.0', only: '^1.0.0' } },
          'node_modules/b': { version: '1.0.0', dependencies: { shared: '^1.0.0' } },
          'node_modules/only': { version: '1.0.0' },
          'node_modules/shared': { version: '1.0.0' },
        },
      }),
    });

    const result = await tool.execute({ name: 'a' });

    const lockWrite = vi.mocked(mockFS.writeFile).mock.calls.find(([path]) => path === '/test/project/package-lock.json');
    const lock = JSON.parse(lockWrite![1] as string);
    expect(Object.keys(lock.packages)).toEqual(['', 'node_modules/b', 'node_modules/shared']);
    expect(lock.packages[''].dependencies).toEqual({ b: '^1.0.0' });
    expect(result.content).toContain('Updated: package.json, package-lock.json');
  });
});
