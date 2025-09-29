import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Simple hook to manage a message queue per project.
 * Messages are only stored in memory and cleared when AI processes them.
 */
export function useMessageQueue(projectId: string) {
	// Use ref to store queues for all projects to persist across re-renders
	const queuesRef = useRef<Map<string, Array<{ content: string; attachedFiles: File[] }>>>(new Map());

	// Local state for current project's queue to trigger re-renders
	const [currentQueue, setCurrentQueue] = useState<Array<{ content: string; attachedFiles: File[] }>>([]);

	// Sync current queue with the ref when projectId changes
	useEffect(() => {
		const queue = queuesRef.current.get(projectId) || [];
		setCurrentQueue(queue);
	}, [projectId]);

	const addToQueue = useCallback((content: string, attachedFiles: File[] = []) => {
		if (!content.trim() && attachedFiles.length === 0) return;

		const currentProjectQueue = queuesRef.current.get(projectId) || [];
		const updatedQueue = [...currentProjectQueue, { content: content.trim(), attachedFiles }];

		queuesRef.current.set(projectId, updatedQueue);
		setCurrentQueue(updatedQueue);
	}, [projectId]);

	const clearQueue = useCallback(() => {
		queuesRef.current.set(projectId, []);
		setCurrentQueue([]);
	}, [projectId]);

	const removeFromQueue = useCallback((index: number) => {
		const currentProjectQueue = queuesRef.current.get(projectId) || [];
		const updatedQueue = currentProjectQueue.filter((_, i) => i !== index);

		queuesRef.current.set(projectId, updatedQueue);
		setCurrentQueue(updatedQueue);
	}, [projectId]);

	const hasQueuedMessages = currentQueue.length > 0;
	const queueLength = currentQueue.length;

	return {
		queuedMessages: currentQueue,
		addToQueue,
		clearQueue,
		removeFromQueue,
		hasQueuedMessages,
		queueLength
	};
}
