import { useState, useEffect, useCallback, ReactNode } from 'react';
import {
  addConsoleMessageListener,
  removeConsoleMessageListener,
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

  const updateState = useCallback(() => {
    const hasConsoleErrors = getHasConsoleErrors();
    setHasErrors(hasConsoleErrors);

    if (hasConsoleErrors) {
      const errorMessages = getConsoleMessages().filter(msg => msg.level === 'error');
      const latestError = errorMessages[errorMessages.length - 1];
      setConsoleError(new ProjectPreviewConsoleError(
        `Console error detected: ${latestError.message}`,
        errorMessages
      ));
    } else {
      setConsoleError(null);
    }
  }, []);

  useEffect(() => {
    addConsoleMessageListener(updateState);
    updateState(); // Initial sync

    return () => removeConsoleMessageListener(updateState);
  }, [updateState]);

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