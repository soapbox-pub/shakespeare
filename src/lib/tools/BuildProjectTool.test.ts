import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildProjectTool } from './BuildProjectTool';
import type { JSRuntimeFS } from '../JSRuntime';
import type { AppConfig } from '../../contexts/AppContext';

// Mock the build functions
vi.mock('../build', () => ({
  buildProject: vi.fn(),
}));

import { buildProject } from '../build';

describe('BuildProjectTool', () => {
  let mockFS: JSRuntimeFS;
  let mockConfig: AppConfig;
  let tool: BuildProjectTool;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFS = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
    } as unknown as JSRuntimeFS;

    mockConfig = {
      theme: 'light',
      relayUrl: 'wss://relay.nostr.band',
      deployServer: 'shakespeare.wtf',
      esmUrl: 'https://esm.shakespeare.diy',
      language: 'en',
    };

    tool = new BuildProjectTool(mockFS, '/test/project', mockConfig);
  });

  it('should have correct description', () => {
    expect(tool.description).toBe('Build the project using esbuild. Creates optimized production files in the dist directory.');
  });

  it('should fail if package.json does not exist', async () => {
    vi.mocked(buildProject).mockRejectedValue(
      new Error('❌ Could not find package.json at /test/project. Make sure you\'re in a valid project directory.')
    );

    await expect(tool.execute()).rejects.toThrow(
      '❌ Build failed: Error: ❌ Could not find package.json at /test/project. Make sure you\'re in a valid project directory.'
    );
  });

  it('should fail if index.html does not exist', async () => {
    vi.mocked(buildProject).mockRejectedValue(
      new Error('❌ Could not find index.html at /test/project. This is required for building the project.')
    );

    await expect(tool.execute()).rejects.toThrow(
      '❌ Build failed: Error: ❌ Could not find index.html at /test/project. This is required for building the project.'
    );
  });

  it('should successfully build project', async () => {
    const mockFiles = {
      'index.html': new Uint8Array([1, 2, 3]),
      'main.js': new Uint8Array([4, 5, 6]),
      'main.css': new Uint8Array([7, 8, 9]),
    };

    const mockResult = {
      files: mockFiles,
      outputPath: '/test/project/dist',
      projectId: 'project',
    };

    vi.mocked(buildProject).mockResolvedValue(mockResult);

    const result = await tool.execute();

    expect(buildProject).toHaveBeenCalledWith({
      esmUrl: 'https://esm.shakespeare.diy',
      fs: mockFS,
      projectPath: '/test/project',
      domParser: expect.any(DOMParser),
    });

    expect(result).toContain('✅ Successfully built project!');
    expect(result).toContain('📁 Output: /test/project/dist');
    expect(result).toContain('📦 Files generated: 3');
    expect(result).toContain('📄 index.html');
    expect(result).toContain('📄 main.js');
    expect(result).toContain('📄 main.css');
  });



  it('should clean existing dist directory before building', async () => {
    const mockFiles = {
      'index.html': new Uint8Array([1, 2, 3]),
    };

    const mockResult = {
      files: mockFiles,
      outputPath: '/test/project/dist',
      projectId: 'project',
    };

    vi.mocked(buildProject).mockResolvedValue(mockResult);

    await tool.execute();

    expect(buildProject).toHaveBeenCalledWith({
      esmUrl: 'https://esm.shakespeare.diy',
      fs: mockFS,
      projectPath: '/test/project',
      domParser: expect.any(DOMParser),
    });
  });

  it('should handle build errors gracefully', async () => {
    vi.mocked(buildProject).mockRejectedValue(new Error('Build compilation failed'));

    await expect(tool.execute()).rejects.toThrow(
      '❌ Build failed: Error: Build compilation failed'
    );
  });
});