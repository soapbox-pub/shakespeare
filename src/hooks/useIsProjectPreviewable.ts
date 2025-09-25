import { useQuery } from '@tanstack/react-query';
import { useProjectsManager } from './useProjectsManager';

/**
 * Hook to check if a project is previewable
 * A project is previewable if it has index.html, package.json, and package-lock.json
 */
export function useIsProjectPreviewable(projectId: string) {
  const projectsManager = useProjectsManager();

  const result = useQuery({
    queryKey: ['project-previewable', projectId],
    queryFn: async () => {
      try {
        // Check for required files
        const [hasIndexHtml, hasPackageJson, hasPackageLock] = await Promise.all([
          projectsManager.fileExists(projectId, 'index.html'),
          projectsManager.fileExists(projectId, 'package.json'),
          projectsManager.fileExists(projectId, 'package-lock.json'),
        ]);

        return hasIndexHtml && hasPackageJson && hasPackageLock;
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