import { useContext } from 'react';
import { GitSyncContext } from '@/contexts/GitSyncContext';

export function useGitSyncState() {
  const context = useContext(GitSyncContext);
  if (!context) {
    throw new Error('useGitSyncState must be used within GitSyncProvider');
  }
  return context;
}
