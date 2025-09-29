import { useCallback, useState, useEffect } from 'react';

// Global drafts storage shared across all hook instances
const globalDrafts = new Map<string, string>();

// Global listeners for draft changes
const listeners = new Set<() => void>();

// Notify all listeners when drafts change
const notifyListeners = () => {
	listeners.forEach(listener => listener());
};

/**
 * Hook to manage draft messages per project.
 * Drafts are stored in global memory and persist when switching between projects.
 * Drafts are cleared when messages are sent or queued.
 * 
 * Can be used in two ways:
 * 1. With projectId - for managing drafts for a specific project
 * 2. Without projectId - for accessing global draft functionality (checking any project's drafts)
 */
export function useDraftMessages(projectId?: string) {
	// Use state to trigger re-renders when drafts change
	const [, forceUpdate] = useState(0);

	// Register listener for draft changes
	useEffect(() => {
		const listener = () => forceUpdate(prev => prev + 1);
		listeners.add(listener);
		return () => listeners.delete(listener);
	}, []);

	// Get draft for a specific project (or current project if projectId provided)
	const getDraft = useCallback((targetProjectId?: string): string => {
		const id = targetProjectId || projectId;
		if (!id) return '';
		return globalDrafts.get(id) || '';
	}, [projectId]);

	// Save draft for a specific project (or current project if projectId provided)
	const saveDraft = useCallback((content: string, targetProjectId?: string) => {
		const id = targetProjectId || projectId;
		if (!id) return;

		if (content.trim()) {
			globalDrafts.set(id, content);
		} else {
			// Clear draft if content is empty
			globalDrafts.delete(id);
		}
		notifyListeners();
	}, [projectId]);

	// Clear draft for a specific project (or current project if projectId provided)
	const clearDraft = useCallback((targetProjectId?: string) => {
		const id = targetProjectId || projectId;
		if (!id) return;

		globalDrafts.delete(id);
		notifyListeners();
	}, [projectId]);

	// Check if a specific project has a draft (or current project if projectId provided)
	const hasDraft = useCallback((targetProjectId?: string): boolean => {
		const id = targetProjectId || projectId;
		if (!id) return false;

		const draft = globalDrafts.get(id);
		return Boolean(draft && draft.trim());
	}, [projectId]);

	// Get all projects that have drafts (global functionality)
	const getProjectsWithDrafts = useCallback((): string[] => {
		const projectsWithDrafts: string[] = [];
		for (const [id, draft] of globalDrafts.entries()) {
			if (draft && draft.trim()) {
				projectsWithDrafts.push(id);
			}
		}
		return projectsWithDrafts;
	}, []);

	return {
		getDraft,
		saveDraft,
		clearDraft,
		hasDraft,
		getProjectsWithDrafts
	};
}
