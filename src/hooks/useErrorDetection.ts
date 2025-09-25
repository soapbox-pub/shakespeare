import { useState, useCallback, useMemo } from 'react';
import type { AIMessage } from '@/lib/SessionManager';
import { useConsoleMessages } from './useConsoleMessages';

export interface ConsoleErrorAlert {
	hasError: boolean;
	errorSummary: string | null;
	errorCount: number;
	dismiss: () => void;
}

export const useConsoleErrorAlert = (
	aiMessages: AIMessage[],
	isBuilding?: boolean,
	isLoading?: boolean
): ConsoleErrorAlert => {
	const { messages } = useConsoleMessages();
	const [dismissedErrorSummary, setDismissedErrorSummary] = useState<string>('');

	const { hasError, errorSummary, errorCount } = useMemo(() => {
		// Don't show alerts while building or AI is working
		if (isBuilding || isLoading) {
			return { hasError: false, errorSummary: null, errorCount: 0 };
		}

		// Find the timestamp of the last AI assistant message
		// Since AIMessage doesn't have timestamps, we'll use a different approach:
		// Only show errors if there are any errors at all and no recent user activity
		const lastMessage = aiMessages[aiMessages.length - 1];
		const isLastMessageFromAssistant = lastMessage?.role === 'assistant';

		// Only show console errors if the last message was from assistant (AI just responded)
		if (!isLastMessageFromAssistant) {
			return { hasError: false, errorSummary: null, errorCount: 0 };
		}

		// Get recent errors (last 10 seconds worth to catch errors from recent AI actions)
		const recentTimeThreshold = Date.now() - (10 * 1000); // 10 seconds ago
		const recentErrors = messages.filter(msg =>
			msg.level === 'error' &&
			msg.timestamp > recentTimeThreshold
		);

		if (recentErrors.length === 0) {
			return { hasError: false, errorSummary: null, errorCount: 0 };
		}

		// Just return the raw error messages, no formatting
		const summary = recentErrors.slice(-3).map(e => e.message).join('\n');

		return {
			hasError: dismissedErrorSummary !== summary,
			errorSummary: summary,
			errorCount: recentErrors.length
		};
	}, [messages, dismissedErrorSummary, aiMessages, isBuilding, isLoading]);

	const dismiss = useCallback(() => {
		if (errorSummary) {
			setDismissedErrorSummary(errorSummary);
		}
	}, [errorSummary]);

	return {
		hasError,
		errorSummary,
		errorCount,
		dismiss
	};
};


