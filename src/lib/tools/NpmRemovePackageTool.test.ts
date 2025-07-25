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

describe('NpmRemovePackageTool', () => {
  let tool: NpmRemovePackageTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new NpmRemovePackageTool(mockFS, '/test/project');
  });

  it('should have correct description and parameters', () => {
    expect(tool.description).toBe('Safely remove an npm package from the project in the current directory.');
    expect(tool.parameters).toBeDefined();
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

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'lodash' });

    expect(mockFS.readFile).toHaveBeenCalledWith('/test/project/package.json', 'utf8');

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.dependencies.lodash).toBeUndefined();
    expect(writtenPackageJson.dependencies.axios).toBe('^1.0.0');
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Successfully removed lodash from dependencies');
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

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'typescript' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.devDependencies.typescript).toBeUndefined();
    expect(writtenPackageJson.devDependencies.eslint).toBe('^8.0.0');
    expect(writtenPackageJson.dependencies.react).toBe('^18.0.0');
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('✅ Successfully removed typescript from devDependencies');
  });

  it('should remove empty dependencies object', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    };

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'lodash' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.dependencies).toBeUndefined();
    expect(result.isError).toBe(false);
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

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'typescript' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);

    expect(writtenPackageJson.devDependencies).toBeUndefined();
    expect(writtenPackageJson.dependencies.react).toBe('^18.0.0');
    expect(result.isError).toBe(false);
  });

  it('should handle package not found', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0'
      }
    };

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'nonexistent-package' });

    expect(mockFS.writeFile).not.toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('ℹ️ Package nonexistent-package was not found');
  });

  it('should handle missing package.json', async () => {
    vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

    const result = await tool.execute({ name: 'lodash' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Could not read package.json');
  });

  it('should handle invalid package.json', async () => {
    vi.mocked(mockFS.readFile).mockResolvedValue('invalid json');

    const result = await tool.execute({ name: 'lodash' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Invalid package.json format');
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

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'lodash' });

    const writtenContent = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
    const writtenPackageJson = JSON.parse(writtenContent);
    const dependencyKeys = Object.keys(writtenPackageJson.dependencies);

    expect(dependencyKeys).toEqual(['axios', 'zlib']);
    expect(result.isError).toBe(false);
  });

  it('should include version information in success message', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    };

    vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ name: 'lodash' });

    expect(result.content[0].text).toContain('🏷️ Version: ^4.17.21');
    expect(result.content[0].text).toContain('📁 Removed from: dependencies');
  });
});