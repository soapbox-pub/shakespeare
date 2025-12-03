import { useQuery } from '@tanstack/react-query';
import { useChatsManager } from '@/hooks/useChatsManager';
import type { Chat } from '@/lib/ChatsManager';

export function useChats() {
  const chatsManager = useChatsManager();

  return useQuery({
    queryKey: ['chats'],
    queryFn: async (): Promise<Chat[]> => {
      await chatsManager.init();
      const chats = await chatsManager.getChats();
      
      // Sort chats by lastModified (newest first)
      return chats.sort((a, b) => {
        return b.lastModified.getTime() - a.lastModified.getTime();
      });
    },
  });
}
