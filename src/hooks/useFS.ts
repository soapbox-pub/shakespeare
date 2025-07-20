import { useContext } from 'react';
import { FSContext, type FSContextType } from '@/contexts/FSContext';

/**
 * Hook to access the filesystem
 * @returns Filesystem context with fs instance
 */
export function useFS(): FSContextType {
  const context = useContext(FSContext);
  if (context === undefined) {
    throw new Error('useFS must be used within a FSProvider');
  }
  return context;
}