import { useMemo } from 'react';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { ChatsManager } from '@/lib/ChatsManager';

export function useChatsManager() {
  const { fs } = useFS();
  const { chatsPath } = useFSPaths();

  return useMemo(() => {
    return new ChatsManager({
      fs,
      chatsPath,
    });
  }, [fs, chatsPath]);
}
