import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildProjectTool } from './BuildProjectTool';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock the buildProject function
vi.mock('../build', () => ({
  buildProject: vi.fn(),
}));

import { buildProject } from '../build';

describe('BuildProjectTool', () => {
  let mockFS: JSRuntimeFS;
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

    tool = new BuildProjectTool(mockFS, '/test/project');
  });

  it('should have correct description and schema', () => {
    expect(tool.description).toBe('Build the project using esbuild. Creates optimized production files in the dist directory.');
    expect(tool.inputSchema).toBeDefined();
  });

  it('should validate input schema correctly', () => {
    // Valid inputs (empty object only)
    expect(() => tool.inputSchema.parse({})).not.toThrow();
  });

  it('should fail if package.json does not exist', async () => {
    vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

    await expect(tool.execute({})).rejects.toThrow(
      '❌ Could not find package.json at /test/project. Make sure you\'re in a valid project directory.'
    );
  });

  it('should fail if index.html does not exist', async () => {
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('{"name": "test"}') // package.json exists
      .mockRejectedValueOnce(new Error('File not found')); // index.html doesn't exist

    await expect(tool.execute({})).rejects.toThrow(
      '❌ Could not find index.html at /test/project. This is required for building the project.'
    );
  });

  it('should successfully build project', async () => {
    const mockDist = {
      'index.html': new Uint8Array([1, 2, 3]),
      'main.js': new Uint8Array([4, 5, 6]),
      'main.css': new Uint8Array([7, 8, 9]),
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('{"name": "test"}') // package.json
      .mockResolvedValueOnce('<html></html>'); // index.html

    vi.mocked(mockFS.readdir).mockRejectedValue(new Error('Directory not found'));
    vi.mocked(buildProject).mockResolvedValue(mockDist);

    const result = await tool.execute({});

    expect(buildProject).toHaveBeenCalledWith({
      fs: mockFS,
      projectPath: '/test/project',
      domParser: expect.any(DOMParser),
    });

    expect(mockFS.mkdir).toHaveBeenCalledWith('/test/project/dist', { recursive: true });
    expect(mockFS.writeFile).toHaveBeenCalledTimes(3);
    expect(mockFS.writeFile).toHaveBeenCalledWith('/test/project/dist/index.html', mockDist['index.html']);
    expect(mockFS.writeFile).toHaveBeenCalledWith('/test/project/dist/main.js', mockDist['main.js']);
    expect(mockFS.writeFile).toHaveBeenCalledWith('/test/project/dist/main.css', mockDist['main.css']);

    expect(result).toContain('✅ Successfully built project!');
    expect(result).toContain('📦 Files generated: 3');
    expect(result).toContain('📄 index.html');
    expect(result).toContain('📄 main.js');
    expect(result).toContain('📄 main.css');
  });



  it('should clean existing dist directory before building', async () => {
    const mockDist = {
      'index.html': new Uint8Array([1, 2, 3]),
    };

    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('{"name": "test"}') // package.json
      .mockResolvedValueOnce('<html></html>'); // index.html

    vi.mocked(mockFS.readdir).mockResolvedValue(['old-file.js', 'old-style.css']);
    vi.mocked(buildProject).mockResolvedValue(mockDist);

    await tool.execute({});

    expect(mockFS.readdir).toHaveBeenCalledWith('/test/project/dist');
    expect(mockFS.unlink).toHaveBeenCalledWith('/test/project/dist/old-file.js');
    expect(mockFS.unlink).toHaveBeenCalledWith('/test/project/dist/old-style.css');
  });

  it('should handle build errors gracefully', async () => {
    vi.mocked(mockFS.readFile)
      .mockResolvedValueOnce('{"name": "test"}') // package.json
      .mockResolvedValueOnce('<html></html>'); // index.html

    vi.mocked(buildProject).mockRejectedValue(new Error('Build compilation failed'));

    await expect(tool.execute({})).rejects.toThrow(
      '❌ Build failed: Error: Build compilation failed'
    );
  });
});