import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { useProjects } from './useProjects';
import type { Project } from '@/lib/ProjectsManager';

// Mock the useProjectsManager hook
vi.mock('./useProjectsManager', () => ({
  useProjectsManager: () => ({
    init: vi.fn().mockResolvedValue(undefined),
    getProjects: vi.fn().mockResolvedValue([
      {
        id: 'project-1',
        name: 'Project 1',
        lastModified: new Date('2023-01-01'),
      },
      {
        id: 'project-2',
        name: 'Project 2',
        lastModified: new Date('2023-01-02'),
      },
      {
        id: 'project-3',
        name: 'Project 3',
        lastModified: new Date('2023-01-03'),
      },
    ] as Project[]),
  }),
}));

// Mock localStorage for favorites
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('[]');
  });

  it('should load and return projects', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].name).toBe('Project 3'); // Most recent first
  });

  it('should sort favorites first, then by lastModified', async () => {
    // Mock favorites to include project-1
    mockLocalStorage.getItem.mockReturnValue('["project-1"]');

    const { result } = renderHook(() => useProjects(), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].id).toBe('project-1'); // Favorite first
    expect(result.current.data?.[1].id).toBe('project-3'); // Then most recent
    expect(result.current.data?.[2].id).toBe('project-2'); // Then older
  });

  it('should handle multiple favorites correctly', async () => {
    // Mock favorites to include project-1 and project-2
    mockLocalStorage.getItem.mockReturnValue('["project-1", "project-2"]');

    const { result } = renderHook(() => useProjects(), {
      wrapper: TestApp,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    // Favorites should be sorted by lastModified among themselves
    expect(result.current.data?.[0].id).toBe('project-2'); // Favorite + more recent
    expect(result.current.data?.[1].id).toBe('project-1'); // Favorite + older
    expect(result.current.data?.[2].id).toBe('project-3'); // Not favorite
  });
});