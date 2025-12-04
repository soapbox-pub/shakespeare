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
  isPoppedOut: boolean;
  sendMessage: (content: string, providerModel: string) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => void;
  setIsOpen: (open: boolean) => void;
  setIsPoppedOut: (poppedOut: boolean) => void;
}

export const GlobalChatContext = createContext<GlobalChatContextType | undefined>(undefined);
