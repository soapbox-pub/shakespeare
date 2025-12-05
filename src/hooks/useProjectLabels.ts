import { useLocalStorage } from '@/hooks/useLocalStorage';

/** Map of project IDs to their assigned label IDs */
type ProjectLabelsMap = Record<string, string[]>;

/**
 * Hook for managing project-label associations
 */
export function useProjectLabels() {
  const [projectLabels, setProjectLabels] = useLocalStorage<ProjectLabelsMap>('project-label-assignments', {});

  const getProjectLabels = (projectId: string): string[] => {
    return projectLabels[projectId] || [];
  };

  const addLabelToProject = (projectId: string, labelId: string) => {
    const currentLabels = projectLabels[projectId] || [];
    if (!currentLabels.includes(labelId)) {
      setProjectLabels({
        ...projectLabels,
        [projectId]: [...currentLabels, labelId],
      });
    }
  };

  const removeLabelFromProject = (projectId: string, labelId: string) => {
    const currentLabels = projectLabels[projectId] || [];
    const newLabels = currentLabels.filter(id => id !== labelId);
    if (newLabels.length === 0) {
      const { [projectId]: _, ...rest } = projectLabels;
      setProjectLabels(rest);
    } else {
      setProjectLabels({
        ...projectLabels,
        [projectId]: newLabels,
      });
    }
  };

  const setProjectLabelsList = (projectId: string, labelIds: string[]) => {
    if (labelIds.length === 0) {
      const { [projectId]: _, ...rest } = projectLabels;
      setProjectLabels(rest);
    } else {
      setProjectLabels({
        ...projectLabels,
        [projectId]: labelIds,
      });
    }
  };

  const getProjectsByLabel = (labelId: string): string[] => {
    return Object.entries(projectLabels)
      .filter(([_, labels]) => labels.includes(labelId))
      .map(([projectId]) => projectId);
  };

  const hasAnyLabels = (): boolean => {
    return Object.keys(projectLabels).length > 0;
  };

  const removeLabel = (labelId: string) => {
    const newProjectLabels: ProjectLabelsMap = {};
    for (const [projectId, labels] of Object.entries(projectLabels)) {
      const filtered = labels.filter(id => id !== labelId);
      if (filtered.length > 0) {
        newProjectLabels[projectId] = filtered;
      }
    }
    setProjectLabels(newProjectLabels);
  };

  return {
    projectLabels,
    getProjectLabels,
    addLabelToProject,
    removeLabelFromProject,
    setProjectLabelsList,
    getProjectsByLabel,
    hasAnyLabels,
    removeLabel,
  };
}
