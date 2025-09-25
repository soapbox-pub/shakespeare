import type { ConsoleMessage } from '@/types/console';

// Simple global console messages storage
const consoleMessages: ConsoleMessage[] = [];

export const addConsoleMessage = (level: ConsoleMessage['level'], message: string) => {
  consoleMessages.push({
    id: Date.now() + Math.random(),
    level,
    message,
    timestamp: Date.now(),
  });
};

export const getConsoleMessages = (): ConsoleMessage[] => {
  return [...consoleMessages];
};

export const clearConsoleMessages = () => {
  consoleMessages.length = 0;
};