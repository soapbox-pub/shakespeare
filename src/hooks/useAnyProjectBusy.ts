import { useState, useEffect } from 'react';
import { useSessionManager } from './useSessionManager';

/**
 * Hook to check if any project has running AI sessions
 * @returns {boolean} True if any project has a running AI session
 */
export function useAnyProjectBusy(): boolean {
	const sessionManager = useSessionManager();
	const [anyProjectBusy, setAnyProjectBusy] = useState(false);

	useEffect(() => {
		const updateStatus = () => {
			const sessions = sessionManager.getAllSessions();
			const hasBusyProject = sessions.some(session => session.isLoading);
			setAnyProjectBusy(hasBusyProject);
		};

		// Initial update
		updateStatus();

		// Subscribe to session changes
		sessionManager.on('sessionCreated', updateStatus);
		sessionManager.on('sessionDeleted', updateStatus);
		sessionManager.on('loadingChanged', updateStatus);

		return () => {
			sessionManager.off('sessionCreated', updateStatus);
			sessionManager.off('sessionDeleted', updateStatus);
			sessionManager.off('loadingChanged', updateStatus);
		};
	}, [sessionManager]);

	return anyProjectBusy;
}
