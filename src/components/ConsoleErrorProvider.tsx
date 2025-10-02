import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  addErrorStateListener,
  removeErrorStateListener,
  getHasConsoleErrors,
  getConsoleMessages,
  clearConsoleMessages,
  ProjectPreviewConsoleError
} from '@/lib/consoleMessages';
import { ConsoleErrorContext } from '@/contexts/ConsoleErrorContext';

interface ConsoleErrorProviderProps {
  children: ReactNode;
}

export function ConsoleErrorProvider({ children }: ConsoleErrorProviderProps) {
  const [hasErrors, setHasErrors] = useState(() => getHasConsoleErrors());
  const [consoleError, setConsoleError] = useState<ProjectPreviewConsoleError | null>(null);
  const lastErrorCountRef = useRef(0);

  // Update console error with latest error information
  const updateConsoleError = useCallback(() => {
    const messages = getConsoleMessages();
    const errorMessages = messages.filter(msg => msg.level === 'error');

    if (errorMessages.length > 0) {
      const error = new ProjectPreviewConsoleError(
        `Console error detected: ${errorMessages[errorMessages.length - 1].message}`,
        errorMessages
      );
      setConsoleError(error);
      lastErrorCountRef.current = errorMessages.length;
    } else {
      setConsoleError(null);
      lastErrorCountRef.current = 0;
    }
  }, []);

  // Handle error state changes from the global console system
  useEffect(() => {
    const handleErrorStateChange = (hasErrors: boolean) => {
      setHasErrors(hasErrors);

      if (hasErrors) {
        // Always update when we get an error state change
        updateConsoleError();
      } else {
        // Clear console error when state resets
        setConsoleError(null);
        lastErrorCountRef.current = 0;
      }
    };

    // Check for new errors periodically when we have errors
    const checkForNewErrors = () => {
      const messages = getConsoleMessages();
      const errorMessages = messages.filter(msg => msg.level === 'error');

      if (errorMessages.length > lastErrorCountRef.current) {
        // New errors detected - update the console error
        updateConsoleError();
      }
    };

    // Listen for error state changes
    addErrorStateListener(handleErrorStateChange);

    // Initial sync
    setHasErrors(getHasConsoleErrors());
    updateConsoleError();

    // Poll for new errors (handles multiple errors being added)
    const interval = setInterval(checkForNewErrors, 100);

    return () => {
      removeErrorStateListener(handleErrorStateChange);
      clearInterval(interval);
    };
  }, [updateConsoleError]);

  const clearErrors = useCallback(() => {
    clearConsoleMessages();
  }, []);

  const dismissConsoleError = useCallback(() => {
    setConsoleError(null);
  }, []);

  const value = {
    hasErrors,
    consoleError,
    clearErrors,
    dismissConsoleError,
  };

  return (
    <ConsoleErrorContext.Provider value={value}>
      {children}
    </ConsoleErrorContext.Provider>
  );
}