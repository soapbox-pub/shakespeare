import { useCallback, useRef } from 'react';

/**
 * Hook to manage draft messages per project.
 * Drafts are stored in memory and persist when switching between projects.
 * Drafts are cleared when messages are sent or queued.
 */
export function useDraftMessages(projectId: string) {
	// Use ref to store drafts for all projects to persist across re-renders
	const draftsRef = useRef<Map<string, string>>(new Map());

	// Get the current draft for this project
	const getDraft = useCallback((): string => {
		return draftsRef.current.get(projectId) || '';
	}, [projectId]);

	// Save draft for this project
	const saveDraft = useCallback((content: string) => {
		if (content.trim()) {
			draftsRef.current.set(projectId, content);
		} else {
			// Clear draft if content is empty
			draftsRef.current.delete(projectId);
		}
	}, [projectId]);

	// Clear draft for this project
	const clearDraft = useCallback(() => {
		draftsRef.current.delete(projectId);
	}, [projectId]);

	// Check if this project has a draft
	const hasDraft = useCallback((): boolean => {
		const draft = draftsRef.current.get(projectId);
		return Boolean(draft && draft.trim());
	}, [projectId]);

	return {
		getDraft,
		saveDraft,
		clearDraft,
		hasDraft
	};
}
