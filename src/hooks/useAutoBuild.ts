import { useEffect, useRef, useCallback } from 'react';
import { BuildDebouncer } from '@/lib/BuildDebouncer';
import { useBuildProject } from './useBuildProject';
import { useSessionSubscription } from './useSessionSubscription';

interface UseAutoBuildOptions {
  projectId: string;
  enabled?: boolean;
  debounceMs?: number;
}

/**
 * Hook that automatically builds a project when files are changed by the AI.
 * Uses a debouncer to avoid excessive builds.
 */
export function useAutoBuild({
  projectId,
  enabled = true,
  debounceMs = 2000
}: UseAutoBuildOptions) {
  const { mutate: buildProject, isPending: isBuildPending } = useBuildProject(projectId);

  const debouncerRef = useRef<BuildDebouncer | null>(null);

  // Initialize debouncer
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBuild = (buildProjectId: string, changedFiles: string[]) => {
      console.log(`Auto-building project ${buildProjectId} after changes to:`, changedFiles);
      buildProject();
    };

    debouncerRef.current = new BuildDebouncer(debounceMs, handleBuild);

    return () => {
      debouncerRef.current?.cleanup();
      debouncerRef.current = null;
    };
  }, [enabled, debounceMs, buildProject]);

  // Listen for file changes from the session manager
  useSessionSubscription('fileChanged', (changedProjectId: string, filePath: string) => {
    if (changedProjectId === projectId && enabled && debouncerRef.current) {
      console.log(`File changed in project ${projectId}:`, filePath);
      debouncerRef.current.registerFileChange(projectId, filePath);
    }
  }, [projectId, enabled]);

  // Cancel pending builds when AI stops loading
  useSessionSubscription('loadingChanged', (changedProjectId: string, isLoading: boolean) => {
    if (changedProjectId === projectId && !isLoading && enabled && debouncerRef.current) {
      // When AI stops, trigger any pending build immediately
      if (debouncerRef.current.hasPendingChanges(projectId)) {
        console.log(`AI stopped, triggering pending build for ${projectId}`);
        debouncerRef.current.triggerBuild(projectId);
      }
    }
  }, [projectId, enabled]);

  const triggerBuild = useCallback(() => {
    debouncerRef.current?.triggerBuild(projectId);
  }, [projectId]);

  const cancelBuild = useCallback(() => {
    debouncerRef.current?.cancel(projectId);
  }, [projectId]);

  const hasPendingChanges = useCallback(() => {
    return debouncerRef.current?.hasPendingChanges(projectId) || false;
  }, [projectId]);

  return {
    triggerBuild,
    cancelBuild,
    hasPendingChanges,
    isBuildPending,
  };
}
