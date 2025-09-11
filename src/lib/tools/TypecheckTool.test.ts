import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TypecheckTool } from './TypecheckTool';
import type { JSRuntimeFS } from '../JSRuntime';

describe('TypecheckTool', () => {
  let mockFS: JSRuntimeFS;
  let tool: TypecheckTool;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFS = {
      readFile: vi.fn(),
    } as unknown as JSRuntimeFS;

    tool = new TypecheckTool(mockFS, '/test/project');
  });

  it('should have correct description', () => {
    expect(tool.description).toBe('Run TypeScript type checking on the project to verify there are no type errors.');
  });

  it('should fail if tsconfig.json does not exist', async () => {
    vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

    await expect(tool.execute()).rejects.toThrow(
      '❌ Could not find tsconfig.json at /test/project. Make sure you\'re in a valid TypeScript project.'
    );
  });

  it('should successfully return no type errors (stub implementation)', async () => {
    vi.mocked(mockFS.readFile).mockResolvedValue('{"compilerOptions": {}}'); // tsconfig.json exists

    const result = await tool.execute();

    expect(result).toContain('✅ No type errors found.');
    expect(result).toContain('🔍 TypeScript compilation completed successfully.');
    expect(result).toContain('📁 Project: /test/project');
  });

  it('should handle file system errors gracefully', async () => {
    vi.mocked(mockFS.readFile).mockRejectedValue(new Error('Permission denied'));

    await expect(tool.execute()).rejects.toThrow(
      '❌ Could not find tsconfig.json at /test/project. Make sure you\'re in a valid TypeScript project.'
    );
  });
});