import { useQuery } from '@tanstack/react-query';
import { useProjectsManager } from './useProjectsManager';

/**
 * Hook to check if a project is previewable
 * A project is previewable if it's either:
 * 1. A React/Vite project (has index.html and package.json)
 * 2. A SvelteKit project (has src/app.html or svelte.config.js/ts and package.json)
 */
export function useIsProjectPreviewable(projectId: string) {
  const projectsManager = useProjectsManager();

  const result = useQuery({
    queryKey: ['project-previewable', projectId],
    queryFn: async () => {
      try {
        // Check for package.json (required for all projects)
        const hasPackageJson = await projectsManager.fileExists(projectId, 'package.json');
        if (!hasPackageJson) return false;

        // Check for React/Vite project (index.html at root)
        const hasIndexHtml = await projectsManager.fileExists(projectId, 'index.html');
        if (hasIndexHtml) return true;

        // Check for SvelteKit project
        const [hasAppHtml, hasSvelteConfigJs, hasSvelteConfigTs] = await Promise.all([
          projectsManager.fileExists(projectId, 'src/app.html'),
          projectsManager.fileExists(projectId, 'svelte.config.js'),
          projectsManager.fileExists(projectId, 'svelte.config.ts'),
        ]);

        // SvelteKit project if it has app.html or svelte.config
        const isSvelteKit = hasAppHtml || hasSvelteConfigJs || hasSvelteConfigTs;
        return isSvelteKit;
      } catch (error) {
        console.error('Failed to check if project is previewable:', error);
        return false;
      }
    },
    enabled: !!projectId,
    staleTime: 5000, // Cache for 5 seconds
    refetchOnWindowFocus: false,
  });

  // Return false when query is disabled (empty projectId) or when data is undefined
  return {
    ...result,
    data: result.data ?? false,
  };
}