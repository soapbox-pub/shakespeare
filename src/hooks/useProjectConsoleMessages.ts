import { useState, useCallback, useEffect } from 'react';
import type { ConsoleMessage } from '@/types/console';

export interface ProjectConsoleMessages {
  [projectId: string]: ConsoleMessage[];
}

// Project-specific console messages storage
const projectConsoleMessages: ProjectConsoleMessages = {};
const listeners: Map<string, Set<(messages: ConsoleMessage[]) => void>> = new Map();

const notifyListeners = (projectId: string) => {
  const projectListeners = listeners.get(projectId);
  if (projectListeners) {
    const messages = projectConsoleMessages[projectId] || [];
    projectListeners.forEach(listener => listener([...messages]));
  }
};

export const useProjectConsoleMessages = (projectId: string | null) => {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);



  const clearMessages = useCallback(() => {
    if (!projectId) return;

    projectConsoleMessages[projectId] = [];
    notifyListeners(projectId);
  }, [projectId]);

  const getErrors = useCallback(() => {
    if (!projectId) return [];
    return (projectConsoleMessages[projectId] || []).filter(msg => msg.level === 'error');
  }, [projectId]);

  const getRecentErrors = useCallback((since: number = Date.now() - 10000) => {
    if (!projectId) return [];
    return (projectConsoleMessages[projectId] || []).filter(
      msg => msg.level === 'error' && msg.timestamp && msg.timestamp > since
    );
  }, [projectId]);

  const getAllMessages = useCallback(() => {
    if (!projectId) return [];
    return projectConsoleMessages[projectId] || [];
  }, [projectId]);

  // Subscribe to project-specific state changes
  useEffect(() => {
    if (!projectId) return;

    const listener = (newMessages: ConsoleMessage[]) => {
      setMessages(newMessages);
    };

    // Initialize listeners for this project if not exists
    if (!listeners.has(projectId)) {
      listeners.set(projectId, new Set());
    }

    const projectListeners = listeners.get(projectId)!;
    projectListeners.add(listener);

    // Initialize with current messages
    setMessages(projectConsoleMessages[projectId] || []);

    return () => {
      projectListeners.delete(listener);
      // Clean up empty listener sets
      if (projectListeners.size === 0) {
        listeners.delete(projectId);
      }
    };
  }, [projectId]);

  return {
    messages,
    clearMessages,
    getErrors,
    getRecentErrors,
    getAllMessages,
  };
};

// Export functions for external use (like PreviewPane)
export const addProjectConsoleMessage = (projectId: string, level: ConsoleMessage['level'], message: string) => {
  const newMessage: ConsoleMessage = {
    id: Date.now() + Math.random(),
    level,
    message,
    timestamp: Date.now(),
  };

  // Initialize project messages if not exists
  if (!projectConsoleMessages[projectId]) {
    projectConsoleMessages[projectId] = [];
  }

  // Add to project-specific messages
  projectConsoleMessages[projectId] = [...projectConsoleMessages[projectId], newMessage];
  notifyListeners(projectId);
};

export const clearProjectConsoleMessages = (projectId: string) => {
  projectConsoleMessages[projectId] = [];
  notifyListeners(projectId);
};

export const getProjectConsoleMessages = (projectId: string): ConsoleMessage[] => {
  return projectConsoleMessages[projectId] || [];
};

// Clear all console messages for a project (called when switching projects)
export const clearAllProjectConsoleMessages = (projectId: string) => {
  clearProjectConsoleMessages(projectId);
};