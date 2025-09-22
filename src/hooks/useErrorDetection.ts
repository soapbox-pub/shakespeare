import { useState, useCallback, useMemo } from 'react';
import { useConsoleMessages } from './useConsoleMessages';

export interface ConsoleErrorAlert {
	hasError: boolean;
	errorSummary: string | null;
	errorCount: number;
	dismiss: () => void;
}

export const useConsoleErrorAlert = (): ConsoleErrorAlert => {
	const { messages } = useConsoleMessages();
	const [dismissedErrorSummary, setDismissedErrorSummary] = useState<string>('');

	const { hasError, errorSummary, errorCount } = useMemo(() => {
		const errors = messages.filter(msg => msg.level === 'error');

		if (errors.length === 0) {
			return { hasError: false, errorSummary: null, errorCount: 0 };
		}

		// Just return the raw error messages, no formatting
		const summary = errors.slice(-3).map(e => e.message).join('\n');

		return {
			hasError: dismissedErrorSummary !== summary,
			errorSummary: summary,
			errorCount: errors.length
		};
	}, [messages, dismissedErrorSummary]);

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
	dismiss: () => void;
}

export const useAIModelErrorAlert = (messages: any[]): AIModelErrorAlert => {
	const [dismissedAlertKey, setDismissedAlertKey] = useState<string>('');

	const { hasError, errorMessage, errorType } = useMemo(() => {
		const lastMessage = messages[messages.length - 1];
		if (!lastMessage || lastMessage.role !== 'assistant') {
			return { hasError: false, errorMessage: null, errorType: null };
		}

		const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

		// Define error patterns
		const errorPatterns = [
			{
				test: (content: string) => /AI service error: 422/.test(content) || /Provider returned error/.test(content),
				type: 'error' as const,
				message: 'The AI model encountered an issue. Try switching to a different model or starting a new chat.'
			},
			{
				test: (content: string) => /maximum context length is \d+ tokens/.test(content) || /context length/.test(content),
				type: 'warn' as const,
				message: 'Your conversation is too long for this model. Try starting a new chat or switching to a model with a larger context window.'
			},
			{
				test: (content: string) => /rate limit/i.test(content) || /too many requests/i.test(content),
				type: 'warn' as const,
				message: 'You\'re sending requests too quickly. Please wait a moment before trying again.'
			}
		];

		for (const pattern of errorPatterns) {
			if (pattern.test(content)) {
				const alertKey = `${pattern.message}_${lastMessage.id || Date.now()}`;

				return {
					hasError: dismissedAlertKey !== alertKey,
					errorMessage: pattern.message,
					errorType: pattern.type,
					alertKey
				};
			}
		}

		return { hasError: false, errorMessage: null, errorType: null };
	}, [messages, dismissedAlertKey]);

	const dismiss = useCallback(() => {
		const lastMessage = messages[messages.length - 1];
		if (errorMessage && lastMessage) {
			const alertKey = `${errorMessage}_${lastMessage.id || Date.now()}`;
			setDismissedAlertKey(alertKey);
		}
	}, [errorMessage, messages]);

	return {
		hasError,
		errorMessage,
		errorType,
		dismiss
	};
};
