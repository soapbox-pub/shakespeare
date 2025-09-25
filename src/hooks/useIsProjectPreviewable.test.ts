import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsProjectPreviewable } from './useIsProjectPreviewable';
import { TestApp } from '@/test/TestApp';

// Mock the useProjectsManager hook
const mockFileExists = vi.fn();
vi.mock('./useProjectsManager', () => ({
  useProjectsManager: () => ({
    fileExists: mockFileExists,
  }),
}));

describe('useIsProjectPreviewable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when all required files exist', async () => {
    mockFileExists.mockResolvedValue(true);

    const { result } = renderHook(
      () => useIsProjectPreviewable('test-project'),
      { wrapper: TestApp }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(true);
    expect(mockFileExists).toHaveBeenCalledWith('test-project', 'index.html');
    expect(mockFileExists).toHaveBeenCalledWith('test-project', 'package.json');
    expect(mockFileExists).toHaveBeenCalledWith('test-project', 'package-lock.json');
  });

  it('returns false when index.html is missing', async () => {
    mockFileExists.mockImplementation((projectId: string, filePath: string) => {
      if (filePath === 'index.html') return Promise.resolve(false);
      return Promise.resolve(true);
    });

    const { result } = renderHook(
      () => useIsProjectPreviewable('test-project'),
      { wrapper: TestApp }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });

  it('returns false when package.json is missing', async () => {
    mockFileExists.mockImplementation((projectId: string, filePath: string) => {
      if (filePath === 'package.json') return Promise.resolve(false);
      return Promise.resolve(true);
    });

    const { result } = renderHook(
      () => useIsProjectPreviewable('test-project'),
      { wrapper: TestApp }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });

  it('returns false when package-lock.json is missing', async () => {
    mockFileExists.mockImplementation((projectId: string, filePath: string) => {
      if (filePath === 'package-lock.json') return Promise.resolve(false);
      return Promise.resolve(true);
    });

    const { result } = renderHook(
      () => useIsProjectPreviewable('test-project'),
      { wrapper: TestApp }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });

  it('returns false when projectId is empty', async () => {
    const { result } = renderHook(
      () => useIsProjectPreviewable(''),
      { wrapper: TestApp }
    );

    // When projectId is empty, the query is disabled, so it should not be loading or successful
    expect(result.current.data).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockFileExists).not.toHaveBeenCalled();
  });

  it('returns false when file check throws an error', async () => {
    mockFileExists.mockRejectedValue(new Error('File system error'));

    const { result } = renderHook(
      () => useIsProjectPreviewable('test-project'),
      { wrapper: TestApp }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });
});