import { useState, useCallback, useEffect } from 'react';

export interface ConsoleMessage {
	id: number;
	level: 'log' | 'warn' | 'error' | 'info' | 'debug';
	message: string;
	timestamp: number;
}

// Global state for console messages
let globalConsoleMessages: ConsoleMessage[] = [];
let listeners: Set<(messages: ConsoleMessage[]) => void> = new Set();

const notifyListeners = () => {
	listeners.forEach(listener => listener([...globalConsoleMessages]));
};

export const useConsoleMessages = () => {
	const [messages, setMessages] = useState<ConsoleMessage[]>(globalConsoleMessages);

	const addMessage = useCallback((level: ConsoleMessage['level'], message: string) => {
		const newMessage: ConsoleMessage = {
			id: Date.now() + Math.random(), // Ensure uniqueness
			level,
			message,
			timestamp: Date.now(),
		};

		globalConsoleMessages = [...globalConsoleMessages, newMessage];
		notifyListeners();
	}, []);

	const clearMessages = useCallback(() => {
		globalConsoleMessages = [];
		notifyListeners();
	}, []);

	const getErrorsSince = useCallback((timestamp: number) => {
		return globalConsoleMessages.filter(
			msg => msg.level === 'error' && msg.timestamp > timestamp
		);
	}, []);

	// Subscribe to global state changes
	useEffect(() => {
		const listener = (newMessages: ConsoleMessage[]) => {
			setMessages(newMessages);
		};
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	return {
		messages,
		addMessage,
		clearMessages,
		getErrorsSince,
	};
};

// Export functions for external use (like PreviewPane)
export const addConsoleMessage = (level: ConsoleMessage['level'], message: string) => {
	const newMessage: ConsoleMessage = {
		id: Date.now() + Math.random(),
		level,
		message,
		timestamp: Date.now(),
	};

	globalConsoleMessages = [...globalConsoleMessages, newMessage];
	notifyListeners();
};

export const clearConsoleMessages = () => {
	globalConsoleMessages = [];
	notifyListeners();
};
