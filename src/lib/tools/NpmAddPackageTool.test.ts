import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NpmAddPackageTool } from './NpmAddPackageTool';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('NpmAddPackageTool', () => {
  let tool: NpmAddPackageTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new NpmAddPackageTool(mockFS, '/test/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct description and inputSchema', () => {
    expect(tool.description).toBe('Safely add an npm package to the project in the current directory.');
    expect(tool.inputSchema).toBeDefined();
  });

  it('should successfully add a new package', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockRejectedValueOnce(new Error('File not found')); // package-lock.json doesn't exist

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '4.17.21',
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
        },
        license: 'MIT'
      })
    });

    const result = await tool.execute({ name: 'lodash' });

    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/package.json', 'utf8');
    expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/lodash/latest');
    expect(mockFS.writeFile).toHaveBeenCalledWith(
      '/test/project/package.json',
      expect.stringContaining('"lodash": "^4.17.21"'),
      'utf8'
    );
    expect(result).toContain('✅ Successfully added lodash@4.17.21');
    expect(result).toContain('Updated: package.json');
  });

  it('should add package with specific version', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockRejectedValueOnce(new Error('File not found')); // package-lock.json doesn't exist

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '4.17.20',
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz',
          integrity: 'sha512-PlhdFcillOINfeV7Ni6oF1TAEayyZBoZ8bcshTHqOYJYlrqzRK5hagpagky5o4HfCzzd1TRkXPMFq6cKk9rGmA=='
        },
        license: 'MIT'
      })
    });

    const result = await tool.execute({ name: 'lodash', version: '4.17.20' });

    expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/lodash/4.17.20'); // Should fetch metadata for specified version
    expect(mockFS.writeFile).toHaveBeenCalledWith(
      '/test/project/package.json',
      expect.stringContaining('"lodash": "^4.17.20"'),
      'utf8'
    );
    expect(result).toContain('✅ Successfully added lodash@4.17.20');
  });

  it('should add dev dependency', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      devDependencies: {}
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockRejectedValueOnce(new Error('File not found')); // package-lock.json doesn't exist

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '5.0.0',
        dist: {
          tarball: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz',
          integrity: 'sha512-w90NqzHl3S+GGUNGjREnnLAW6zIsfRIKwG5IwxJmtfAb6dPwx9Pq6Q3aRpIyq4Y7Udq9Y8SdJGrZBj8JKl6qCg=='
        },
        license: 'Apache-2.0'
      })
    });

    const result = await tool.execute({ name: 'typescript', dev: true });

    expect(mockFS.writeFile).toHaveBeenCalledWith(
      '/test/project/package.json',
      expect.stringContaining('"typescript": "^5.0.0"'),
      'utf8'
    );

    // Check that it was written to devDependencies
    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);
    expect(writtenPackageJson.devDependencies.typescript).toBe('^5.0.0');
    expect(writtenPackageJson.dependencies?.typescript).toBeUndefined();

    expect(result).toContain('Development dependency');
  });

  it('should move package from dependencies to devDependencies', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'typescript': '^4.0.0'
      },
      devDependencies: {}
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockRejectedValueOnce(new Error('File not found')); // package-lock.json doesn't exist

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '5.0.0',
        dist: {
          tarball: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz',
          integrity: 'sha512-w90NqzHl3S+GGUNGjREnnLAW6zIsfRIKwG5IwxJmtfAb6dPwx9Pq6Q3aRpIyq4Y7Udq9Y8SdJGrZBj8JKl6qCg=='
        },
        license: 'Apache-2.0'
      })
    });

    const result = await tool.execute({ name: 'typescript', dev: true });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.devDependencies.typescript).toBe('^5.0.0');
    // dependencies object should be empty or not contain typescript
    expect(writtenPackageJson.dependencies?.typescript).toBeUndefined();
    expect(result).toContain('✅ Successfully added');
  });

  it('should handle package already installed', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    };

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '4.17.21',
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
        },
        license: 'MIT'
      })
    });

    const result = await tool.execute({ name: 'lodash' });

    expect(mockFS.writeFile).not.toHaveBeenCalled();
    expect(result).toContain('ℹ️ Package lodash@4.17.21 is already installed');
  });

  it('should handle missing package.json', async () => {
    vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

    await expect(tool.execute({ name: 'lodash' })).rejects.toThrow('❌ Could not read package.json');
  });

  it('should handle invalid package.json', async () => {
    vi.mocked(mockFS.readFile).mockResolvedValue('invalid json');

    await expect(tool.execute({ name: 'lodash' })).rejects.toThrow('❌ Invalid package.json format');
  });

  it('should handle npm registry errors', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(tool.execute({ name: 'nonexistent-package' })).rejects.toThrow('❌ Could not fetch latest version');
  });

  it('should sort dependencies alphabetically', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'zlib': '^1.0.0',
        'axios': '^1.0.0'
      }
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockRejectedValueOnce(new Error('File not found')); // package-lock.json doesn't exist

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '4.17.21',
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
        },
        license: 'MIT'
      })
    });

    const result = await tool.execute({ name: 'lodash' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);
    const dependencyKeys = Object.keys(writtenPackageJson.dependencies);

    expect(dependencyKeys).toEqual(['axios', 'lodash', 'zlib']);
    expect(result).toContain('✅ Successfully added');
  });

  it('should update package-lock.json when it exists', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    const packageLock = {
      name: 'test-project',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'test-project',
          version: '1.0.0',
          dependencies: {}
        }
      }
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockResolvedValueOnce(JSON.stringify(packageLock, null, 2)); // package-lock.json

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '4.17.21',
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
        },
        license: 'MIT'
      })
    });

    const result = await tool.execute({ name: 'lodash' });

    expect(mockFS.writeFile).toHaveBeenCalledTimes(2); // package.json and package-lock.json

    // Check package-lock.json was updated
    const lockWriteCall = vi.mocked(mockFS.writeFile).mock.calls.find(call =>
      call[0] === '/test/project/package-lock.json'
    );
    expect(lockWriteCall).toBeDefined();

    const updatedLock = JSON.parse(lockWriteCall![1] as string);
    expect(updatedLock.packages[''].dependencies.lodash).toBe('^4.17.21');
    expect(updatedLock.packages['node_modules/lodash']).toEqual({
      version: '4.17.21',
      resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
      integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==',
      license: 'MIT'
    });

    expect(result).toContain('Updated: package.json, package-lock.json');
  });

  it('should update package-lock.json for dev dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      devDependencies: {}
    };

    const packageLock = {
      name: 'test-project',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'test-project',
          version: '1.0.0',
          devDependencies: {}
        }
      }
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockResolvedValueOnce(JSON.stringify(packageLock, null, 2)); // package-lock.json

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '5.0.0',
        dist: {
          tarball: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz',
          integrity: 'sha512-w90NqzHl3S+GGUNGjREnnLAW6zIsfRIKwG5IwxJmtfAb6dPwx9Pq6Q3aRpIyq4Y7Udq9Y8SdJGrZBj8JKl6qCg=='
        },
        license: 'Apache-2.0',
        engines: { node: '>=14.17' }
      })
    });

    const result = await tool.execute({ name: 'typescript', dev: true });

    const lockWriteCall = vi.mocked(mockFS.writeFile).mock.calls.find(call =>
      call[0] === '/test/project/package-lock.json'
    );
    expect(lockWriteCall).toBeDefined();

    const updatedLock = JSON.parse(lockWriteCall![1] as string);
    expect(updatedLock.packages[''].devDependencies.typescript).toBe('^5.0.0');
    expect(updatedLock.packages['node_modules/typescript']).toEqual({
      version: '5.0.0',
      resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz',
      integrity: 'sha512-w90NqzHl3S+GGUNGjREnnLAW6zIsfRIKwG5IwxJmtfAb6dPwx9Pq6Q3aRpIyq4Y7Udq9Y8SdJGrZBj8JKl6qCg==',
      license: 'Apache-2.0',
      dev: true,
      engines: { node: '>=14.17' }
    });

    expect(result).toContain('Updated: package.json, package-lock.json');
  });

  it('should move package between dependency types in package-lock.json', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'typescript': '^4.0.0'
      },
      devDependencies: {}
    };

    const packageLock = {
      name: 'test-project',
      version: '1.0.0',
      lockfileVersion: 3,
      requires: true,
      packages: {
        '': {
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'typescript': '^4.0.0'
          },
          devDependencies: {}
        },
        'node_modules/typescript': {
          version: '4.0.0',
          resolved: 'https://registry.npmjs.org/typescript/-/typescript-4.0.0.tgz',
          integrity: 'sha512-old-integrity',
          license: 'Apache-2.0'
        }
      }
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockResolvedValueOnce(JSON.stringify(packageLock, null, 2)); // package-lock.json

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '5.0.0',
        dist: {
          tarball: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz',
          integrity: 'sha512-w90NqzHl3S+GGUNGjREnnLAW6zIsfRIKwG5IwxJmtfAb6dPwx9Pq6Q3aRpIyq4Y7Udq9Y8SdJGrZBj8JKl6qCg=='
        },
        license: 'Apache-2.0'
      })
    });

    const result = await tool.execute({ name: 'typescript', dev: true });

    const lockWriteCall = vi.mocked(mockFS.writeFile).mock.calls.find(call =>
      call[0] === '/test/project/package-lock.json'
    );
    expect(lockWriteCall).toBeDefined();

    const updatedLock = JSON.parse(lockWriteCall![1] as string);

    // Should be moved to devDependencies
    expect(updatedLock.packages[''].devDependencies.typescript).toBe('^5.0.0');
    expect(updatedLock.packages[''].dependencies?.typescript).toBeUndefined();

    // Node modules entry should be updated with new version and dev flag
    expect(updatedLock.packages['node_modules/typescript']).toEqual({
      version: '5.0.0',
      resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz',
      integrity: 'sha512-w90NqzHl3S+GGUNGjREnnLAW6zIsfRIKwG5IwxJmtfAb6dPwx9Pq6Q3aRpIyq4Y7Udq9Y8SdJGrZBj8JKl6qCg==',
      license: 'Apache-2.0',
      dev: true
    });

    expect(result).toContain('✅ Successfully added');
  });

  it('should handle corrupted package-lock.json gracefully', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce(JSON.stringify(packageJson, null, 2)) // package.json
      .mockResolvedValueOnce('invalid json'); // corrupted package-lock.json

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '4.17.21',
        dist: {
          tarball: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
          integrity: 'sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=='
        },
        license: 'MIT'
      })
    });

    // Should not throw error, just log warning and continue
    const result = await tool.execute({ name: 'lodash' });

    expect(result).toContain('✅ Successfully added lodash@4.17.21');
    expect(result).toContain('Updated: package.json'); // Should not mention package-lock.json
    expect(mockFS.writeFile).toHaveBeenCalledTimes(1); // Only package.json should be written
  });
});