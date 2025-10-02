import { useContext } from 'react';
import { ConsoleErrorContext } from '@/contexts/ConsoleErrorContext';

/**
 * Hook to access console error state from the ConsoleErrorProvider.
 * Provides boolean error state and console error information for Quilly.
 */
export function useConsoleError() {
  const context = useContext(ConsoleErrorContext);
  
  if (context === undefined) {
    throw new Error('useConsoleError must be used within a ConsoleErrorProvider');
  }
  
  return context;
}