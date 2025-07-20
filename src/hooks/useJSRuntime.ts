import { useContext } from 'react';
import { JSRuntimeContext, type JSRuntimeContextType } from '@/contexts/JSRuntimeContext';

/**
 * Hook to access the JavaScript runtime
 * @returns JSRuntime context with runtime instance
 */
export function useJSRuntime(): JSRuntimeContextType {
  const context = useContext(JSRuntimeContext);
  if (context === undefined) {
    throw new Error('useJSRuntime must be used within a JSRuntimeProvider');
  }
  return context;
}