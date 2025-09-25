import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

import { ProjectPreviewConsoleError } from '@/lib/errors/ProjectPreviewConsoleError';

export interface ConsoleMessage {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
}

export { ProjectPreviewConsoleError };

interface ConsoleContextType {
  messages: ConsoleMessage[];
  messagesRef: React.MutableRefObject<ConsoleMessage[]>;
  addMessage: (level: ConsoleMessage['level'], message: string) => void;
  clearMessages: () => void;
  addErrorListener: (listener: (error: ProjectPreviewConsoleError) => void) => void;
  removeErrorListener: (listener: (error: ProjectPreviewConsoleError) => void) => void;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

export function useConsole(): ConsoleContextType {
  const context = useContext(ConsoleContext);
  if (context === undefined) {
    throw new Error('useConsole must be used within a ConsoleProvider');
  }
  return context;
}

interface ConsoleProviderProps {
  children: ReactNode;
}

export function ConsoleProvider({ children }: ConsoleProviderProps) {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const messagesRef = useRef<ConsoleMessage[]>([]);
  const [errorListeners, setErrorListeners] = useState<Array<(error: ProjectPreviewConsoleError) => void>>([]);

  const addMessage = useCallback((level: ConsoleMessage['level'], message: string) => {
    const consoleMessage: ConsoleMessage = {
      level,
      message,
    };

    // Update both state and ref
    const newMessages = [...messagesRef.current, consoleMessage];
    messagesRef.current = newMessages;
    setMessages(newMessages);

    // If this is an error, notify listeners
    if (level === 'error') {
      const error = new ProjectPreviewConsoleError(
        `Console error detected: ${message}`,
        newMessages.filter(msg => msg.level === 'error')
      );

      errorListeners.forEach(listener => {
        try {
          listener(error);
        } catch (err) {
          console.warn('Error listener failed:', err);
        }
      });
    }
  }, [errorListeners]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
  }, []);

  const addErrorListener = useCallback((listener: (error: ProjectPreviewConsoleError) => void) => {
    setErrorListeners(prev => [...prev, listener]);
  }, []);

  const removeErrorListener = useCallback((listener: (error: ProjectPreviewConsoleError) => void) => {
    setErrorListeners(prev => prev.filter(l => l !== listener));
  }, []);

  const value: ConsoleContextType = {
    messages,
    messagesRef,
    addMessage,
    clearMessages,
    addErrorListener,
    removeErrorListener,
  };

  return (
    <ConsoleContext.Provider value={value}>
      {children}
    </ConsoleContext.Provider>
  );
}