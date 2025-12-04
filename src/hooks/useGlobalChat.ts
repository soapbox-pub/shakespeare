import { useContext } from 'react';
import { GlobalChatContext, type GlobalChatContextType } from '@/contexts/GlobalChatContext';

export function useGlobalChat(): GlobalChatContextType {
  const context = useContext(GlobalChatContext);
  if (!context) {
    throw new Error('useGlobalChat must be used within a GlobalChatProvider');
  }
  return context;
}
