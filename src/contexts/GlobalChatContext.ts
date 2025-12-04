import { createContext } from 'react';

export interface GlobalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface GlobalChatContextType {
  messages: GlobalChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  hasUnread: boolean;
  providerModel: string;
  setProviderModel: (model: string) => void;
  sendMessage: (content: string, providerModel: string) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => void;
  setIsOpen: (open: boolean) => void;
}

export const GlobalChatContext = createContext<GlobalChatContextType | undefined>(undefined);
