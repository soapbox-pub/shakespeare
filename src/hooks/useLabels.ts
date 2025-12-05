import { useLocalStorage } from '@/hooks/useLocalStorage';

/** Predefined label colors */
export const LABEL_COLORS = [
  { name: 'red', bg: 'bg-red-500', text: 'text-red-500', hover: 'hover:bg-red-500/20' },
  { name: 'orange', bg: 'bg-orange-500', text: 'text-orange-500', hover: 'hover:bg-orange-500/20' },
  { name: 'amber', bg: 'bg-amber-500', text: 'text-amber-500', hover: 'hover:bg-amber-500/20' },
  { name: 'yellow', bg: 'bg-yellow-500', text: 'text-yellow-500', hover: 'hover:bg-yellow-500/20' },
  { name: 'lime', bg: 'bg-lime-500', text: 'text-lime-500', hover: 'hover:bg-lime-500/20' },
  { name: 'green', bg: 'bg-green-500', text: 'text-green-500', hover: 'hover:bg-green-500/20' },
  { name: 'emerald', bg: 'bg-emerald-500', text: 'text-emerald-500', hover: 'hover:bg-emerald-500/20' },
  { name: 'teal', bg: 'bg-teal-500', text: 'text-teal-500', hover: 'hover:bg-teal-500/20' },
  { name: 'cyan', bg: 'bg-cyan-500', text: 'text-cyan-500', hover: 'hover:bg-cyan-500/20' },
  { name: 'sky', bg: 'bg-sky-500', text: 'text-sky-500', hover: 'hover:bg-sky-500/20' },
  { name: 'blue', bg: 'bg-blue-500', text: 'text-blue-500', hover: 'hover:bg-blue-500/20' },
  { name: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-500', hover: 'hover:bg-indigo-500/20' },
  { name: 'violet', bg: 'bg-violet-500', text: 'text-violet-500', hover: 'hover:bg-violet-500/20' },
  { name: 'purple', bg: 'bg-purple-500', text: 'text-purple-500', hover: 'hover:bg-purple-500/20' },
  { name: 'fuchsia', bg: 'bg-fuchsia-500', text: 'text-fuchsia-500', hover: 'hover:bg-fuchsia-500/20' },
  { name: 'pink', bg: 'bg-pink-500', text: 'text-pink-500', hover: 'hover:bg-pink-500/20' },
  { name: 'rose', bg: 'bg-rose-500', text: 'text-rose-500', hover: 'hover:bg-rose-500/20' },
  { name: 'gray', bg: 'bg-gray-500', text: 'text-gray-500', hover: 'hover:bg-gray-500/20' },
] as const;

export type LabelColorName = typeof LABEL_COLORS[number]['name'];

export interface Label {
  id: string;
  name: string;
  color: LabelColorName;
  collapsed?: boolean;
}

/** Get the color config for a label color name */
export function getLabelColor(colorName: LabelColorName) {
  return LABEL_COLORS.find(c => c.name === colorName) || LABEL_COLORS[0];
}

/** Generate a unique label ID */
function generateLabelId(): string {
  return `label-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

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
