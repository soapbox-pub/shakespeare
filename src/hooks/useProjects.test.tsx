import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { useProjects } from './useProjects';
import type { Project } from '@/lib/ProjectsManager';

// Create a test wrapper that provides a fresh QueryClient for each test
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

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

// Mock the useLocalStorage hook
let mockFavorites: string[] = [];
vi.mock('./useLocalStorage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: unknown) => {
    if (key === 'project-favorites') {
      return [mockFavorites, vi.fn()];
    }
    return [defaultValue, vi.fn()];
  }),
}));

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFavorites = [];
  });

  it('should load and return projects', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].name).toBe('Project 3'); // Most recent first
  });

  it('should sort favorites first, then by lastModified', async () => {
    // Set favorites to include project-1
    mockFavorites = ['project-1'];

    const { result } = renderHook(() => useProjects(), {
      wrapper: createTestWrapper(),
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
    // Set favorites to include project-1 and project-2
    mockFavorites = ['project-1', 'project-2'];

    const { result } = renderHook(() => useProjects(), {
      wrapper: createTestWrapper(),
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