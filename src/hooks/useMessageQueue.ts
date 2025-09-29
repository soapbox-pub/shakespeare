import { useState, useCallback } from 'react';

/**
 * Simple hook to manage a message queue for the current project.
 * Messages are only stored in memory and cleared when AI processes them.
 */
export function useMessageQueue() {
	const [queuedMessages, setQueuedMessages] = useState<Array<{ content: string; attachedFiles: File[] }>>([]);

	const addToQueue = useCallback((content: string, attachedFiles: File[] = []) => {
		if (!content.trim() && attachedFiles.length === 0) return;
		setQueuedMessages(prev => [...prev, { content: content.trim(), attachedFiles }]);
	}, []);

	const clearQueue = useCallback(() => {
		setQueuedMessages([]);
	}, []);

	const removeFromQueue = useCallback((index: number) => {
		setQueuedMessages(prev => prev.filter((_, i) => i !== index));
	}, []);

	const hasQueuedMessages = queuedMessages.length > 0;
	const queueLength = queuedMessages.length;

	return {
		queuedMessages,
		addToQueue,
		clearQueue,
		removeFromQueue,
		hasQueuedMessages,
		queueLength
	};
}
