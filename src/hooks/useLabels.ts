import { useLocalStorage } from '@/hooks/useLocalStorage';
import { generateLabelId, type Label, type LabelColorName } from '@/lib/labels';

/**
 * Hook for managing labels (creating, editing, deleting labels)
 */
export function useLabels() {
  const [labels, setLabels] = useLocalStorage<Label[]>('project-labels', []);

  const createLabel = (name: string, color: LabelColorName): Label => {
    const newLabel: Label = {
      id: generateLabelId(),
      name,
      color,
    };
    setLabels([...labels, newLabel]);
    return newLabel;
  };

  const updateLabel = (labelId: string, updates: Partial<Omit<Label, 'id'>>) => {
    setLabels(labels.map(label =>
      label.id === labelId ? { ...label, ...updates } : label
    ));
  };

  const deleteLabel = (labelId: string) => {
    setLabels(labels.filter(label => label.id !== labelId));
  };

  const reorderLabels = (orderedIds: string[]) => {
    const reordered = orderedIds
      .map(id => labels.find(label => label.id === id))
      .filter((label): label is Label => label !== undefined);
    setLabels(reordered);
  };

  const toggleLabelCollapsed = (labelId: string) => {
    setLabels(labels.map(label =>
      label.id === labelId ? { ...label, collapsed: !label.collapsed } : label
    ));
  };

  return {
    labels,
    createLabel,
    updateLabel,
    deleteLabel,
    reorderLabels,
    toggleLabelCollapsed,
  };
}
