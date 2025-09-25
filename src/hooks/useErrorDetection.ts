import { useState, useCallback, useMemo } from 'react';
import type { AIMessage } from '@/lib/SessionManager';
import { getConsoleMessages } from '@/lib/tools/ReadConsoleMessagesTool';

export interface ConsoleErrorAlert {
	hasError: boolean;
	errorSummary: string | null;
	errorCount: number;
	dismiss: () => void;
}

export const useConsoleErrorAlert = (
	aiMessages: AIMessage[],
	projectId?: string | null,
	isBuilding?: boolean,
	isLoading?: boolean
): ConsoleErrorAlert => {
	const [dismissedErrorSummary, setDismissedErrorSummary] = useState<string>('');

	const { hasError, errorSummary, errorCount } = useMemo(() => {
		// Don't show alerts while building or AI is working
		if (isBuilding || isLoading || !projectId) {
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
		const messages = getConsoleMessages();
		const recentErrors = messages.filter(msg =>
			msg.level === 'error' &&
			msg.timestamp && msg.timestamp > recentTimeThreshold
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
	}, [projectId, dismissedErrorSummary, aiMessages, isBuilding, isLoading]);

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

export interface AIModelErrorAlert {
	hasError: boolean;
	errorMessage: string | null;
	errorType: 'warn' | 'error' | null;
	action?: { label: string; onClick: () => void };
	dismiss: () => void;
}

export const useAIModelErrorAlert = (
	messages: AIMessage[],
	onNewChat?: () => void,
	onChangeModel?: () => void
): AIModelErrorAlert => {
	const [dismissedAlertKey, setDismissedAlertKey] = useState<string>('');

	const { hasError, errorMessage, errorType, action } = useMemo(() => {
		const lastMessage = messages[messages.length - 1];

		// Only show AI model alerts if the last message is from the assistant
		// This ensures we don't show stale alerts when user continues the conversation
		if (!lastMessage || lastMessage.role !== 'assistant') {
			return { hasError: false, errorMessage: null, errorType: null, action: undefined };
		}

		const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

		// Define error patterns with actions
		const errorPatterns = [
			{
				test: (content: string) => /AI service error: 422/.test(content) || /Provider returned error/.test(content),
				type: 'error' as const,
				message: 'The AI model encountered an issue. Try switching to a different model or starting a new chat.',
				action: onChangeModel ? { label: 'Change model', onClick: onChangeModel } : undefined
			},
			{
				test: (content: string) => /maximum context length is \d+ tokens/.test(content) || /context length/.test(content),
				type: 'warn' as const,
				message: 'Your conversation is too long for this model. Try starting a new chat or switching to a model with a larger context window.',
				action: onNewChat ? { label: 'New chat', onClick: onNewChat } : undefined
			},
			{
				test: (content: string) => /rate limit/i.test(content) || /too many requests/i.test(content),
				type: 'warn' as const,
				message: 'You\'re sending requests too quickly. Please wait a moment before trying again.'
			}
		];

		for (const pattern of errorPatterns) {
			if (pattern.test(content)) {
				const messageContent = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
				const alertKey = `${pattern.message}_${messageContent.slice(0, 50)}_${Date.now()}`;

				return {
					hasError: dismissedAlertKey !== alertKey,
					errorMessage: pattern.message,
					errorType: pattern.type,
					action: pattern.action,
					alertKey
				};
			}
		}

		return { hasError: false, errorMessage: null, errorType: null, action: undefined };
	}, [messages, dismissedAlertKey, onNewChat, onChangeModel]);

	const dismiss = useCallback(() => {
		const lastMessage = messages[messages.length - 1];
		if (errorMessage && lastMessage) {
			const messageContent = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
			const alertKey = `${errorMessage}_${messageContent.slice(0, 50)}_${Date.now()}`;
			setDismissedAlertKey(alertKey);
		}
	}, [errorMessage, messages]);

	return {
		hasError,
		errorMessage,
		errorType,
		action,
		dismiss
	};
};
