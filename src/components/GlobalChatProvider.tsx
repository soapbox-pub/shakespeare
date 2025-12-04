import { useState, useCallback, useRef, type ReactNode } from 'react';
import OpenAI from 'openai';
import { GlobalChatContext, type GlobalChatMessage } from '@/contexts/GlobalChatContext';
import { useAISettings } from '@/hooks/useAISettings';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { parseProviderModel } from '@/lib/parseProviderModel';
import { createAIClient } from '@/lib/ai-client';

// Maximum context size in characters (approximately 50k tokens worth)
// This leaves room for the system prompt and response
const MAX_CONTEXT_CHARS = 150000;

// Default system prompt for global chat
const DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT = `You are a helpful AI assistant. You're here to have a friendly conversation and help answer questions on any topic.

Keep your responses concise but informative. Be friendly and conversational.`;

interface GlobalChatProviderProps {
  children: ReactNode;
}

export function GlobalChatProvider({ children }: GlobalChatProviderProps) {
  const [messages, setMessages] = useState<GlobalChatMessage[]>([]);
  const [isOpen, setIsOpenInternal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isOpenRef = useRef(false);

  // Separate model storage for global chat (independent from project chat)
  const [globalChatModel, setGlobalChatModel] = useLocalStorage<string>('shakespeare-global-chat-model', '');

  const { settings } = useAISettings();
  const { config } = useAppContext();
  const { user } = useCurrentUser();

  // When opening the chat, mark messages as read
  const setIsOpen = useCallback((open: boolean) => {
    isOpenRef.current = open;
    setIsOpenInternal(open);
    if (open) {
      setHasUnread(false);
    }
  }, []);

  // Trim messages from the top when context gets too long
  const trimMessages = useCallback((msgs: GlobalChatMessage[]): GlobalChatMessage[] => {
    let totalChars = msgs.reduce((sum, msg) => sum + msg.content.length, 0);

    if (totalChars <= MAX_CONTEXT_CHARS) {
      return msgs;
    }

    // Remove messages from the beginning until we're under the limit
    const trimmedMessages = [...msgs];
    while (trimmedMessages.length > 1 && totalChars > MAX_CONTEXT_CHARS) {
      const removed = trimmedMessages.shift();
      if (removed) {
        totalChars -= removed.content.length;
      }
    }

    return trimmedMessages;
  }, []);

  const sendMessage = useCallback(async (content: string, providerModelString: string) => {
    if (!content.trim() || isLoading) return;

    // Parse provider and model
    const { model: modelId, provider } = parseProviderModel(providerModelString, settings.providers);

    if (!provider) {
      console.error('Provider not found');
      return;
    }

    // Create user message
    const userMessage: GlobalChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    // Add user message and trim if necessary
    setMessages(prev => trimMessages([...prev, userMessage]));
    setIsLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Create AI client
      const client = createAIClient(provider, config.corsProxy, user?.signer);

      // Build messages for API
      const systemPrompt = config.globalChatSystemPrompt || DEFAULT_GLOBAL_CHAT_SYSTEM_PROMPT;

      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: content.trim() },
      ];

      // Create assistant message placeholder
      const assistantMessage: GlobalChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Stream the response
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: apiMessages,
        stream: true,
      }, {
        signal: abortControllerRef.current.signal,
      });

      let fullContent = '';
      let loadingReleased = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullContent += delta;

        // Update the assistant message with streamed content
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = fullContent;
          }
          return updated;
        });

        // Check if the stream is finished (finish_reason is set)
        // Only release once to avoid multiple state updates
        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason && !loadingReleased) {
          loadingReleased = true;
          // Response is complete, release the input immediately
          setIsLoading(false);
          // Break out of the loop - we don't need any more chunks
          break;
        }
      }

      // Final trim after response is complete
      setMessages(prev => trimMessages(prev));

      // Mark as unread if chat is closed
      if (!isOpenRef.current) {
        setHasUnread(true);
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User stopped generation, keep partial response
        return;
      }

      console.error('Global chat error:', error);

      // Add error message
      const errorMessage: GlobalChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };

      setMessages(prev => {
        // Remove empty assistant message if exists
        const filtered = prev.filter(m => m.role !== 'assistant' || m.content.trim());
        return [...filtered, errorMessage];
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [config.corsProxy, config.globalChatSystemPrompt, isLoading, messages, settings.providers, trimMessages, user?.signer]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <GlobalChatContext.Provider
      value={{
        messages,
        isOpen,
        isLoading,
        hasUnread,
        providerModel: globalChatModel,
        setProviderModel: setGlobalChatModel,
        sendMessage,
        stopGeneration,
        clearMessages,
        setIsOpen,
      }}
    >
      {children}
    </GlobalChatContext.Provider>
  );
}
