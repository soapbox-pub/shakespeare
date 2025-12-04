import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { X, Trash2, Copy, Check, ChevronDown, ArrowUp, Square, Loader2, Hammer } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ModelSelector } from '@/components/ModelSelector';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { useAppContext } from '@/hooks/useAppContext';
import { useAISettings } from '@/hooks/useAISettings';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { GlobalChatMessage } from '@/contexts/GlobalChatContext';

// Message component with copy functionality
function ChatMessage({ message }: { message: GlobalChatMessage }) {
  const [copied, setCopied] = useState(false);
  const { displayTheme } = useTheme();
  const isUser = message.role === 'user';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [message.content]);

  return (
    <div
      className={cn(
        'group relative flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'relative max-w-[85%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="text-sm break-words">
            <Streamdown
              className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose prose-sm dark:prose-invert max-w-none"
              shikiTheme={displayTheme === 'dark' ? 'github-dark' : 'github-light'}
            >
              {message.content || '...'}
            </Streamdown>
          </div>
        )}

        {/* Copy button - shows on hover */}
        <button
          onClick={handleCopy}
          className={cn(
            'absolute -bottom-1 opacity-0 group-hover:opacity-100 transition-opacity',
            'p-1 rounded bg-background/80 hover:bg-background shadow-sm border',
            isUser ? 'right-0 translate-y-full' : 'left-0 translate-y-full'
          )}
          aria-label="Copy message"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}

interface GlobalChatPaneProps {
  /** When true, renders inline without fixed positioning (for embedding in ProjectView) */
  embedded?: boolean;
  /** Mobile chat mode toggle - only used in embedded mode */
  mobileChatMode?: 'building' | 'chatting';
  onMobileChatModeChange?: (mode: 'building' | 'chatting') => void;
}

export function GlobalChatPane({ embedded = false, mobileChatMode, onMobileChatModeChange }: GlobalChatPaneProps) {
  const { t } = useTranslation();
  const {
    messages,
    isOpen,
    isLoading,
    sendMessage,
    stopGeneration,
    clearMessages,
    setIsOpen,
    providerModel,
    setProviderModel,
  } = useGlobalChat();
  const { config } = useAppContext();
  const { settings } = useAISettings();
  const isMobile = useIsMobile();
  const location = useLocation();

  const [input, setInput] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track if user has manually scrolled up
  const userScrolledUp = useRef(false);
  // Track the last message content to detect streaming updates
  const lastMessageContent = messages[messages.length - 1]?.content || '';

  // Initialize provider model from settings if not set
  useEffect(() => {
    if (!providerModel && settings.recentlyUsedModels?.length) {
      setProviderModel(settings.recentlyUsedModels[0]);
    }
  }, [providerModel, settings.recentlyUsedModels, setProviderModel]);

  // Scroll to bottom and focus textarea when chat opens (or when embedded mode becomes active)
  useEffect(() => {
    const shouldScroll = isOpen || embedded;
    if (shouldScroll && scrollAreaRef.current) {
      // Small delay to ensure content is rendered
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
        // Focus the textarea so user can start typing immediately
        textareaRef.current?.focus();
      });
      // Reset scroll tracking when opening
      userScrolledUp.current = false;
    }
  }, [isOpen, embedded]);

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    const isActive = isOpen || embedded;
    if (!scrollAreaRef.current || !isActive) return;

    // Only auto-scroll if user hasn't manually scrolled up
    if (!userScrolledUp.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, lastMessageContent, isLoading, isOpen, embedded]);

  // Handle scroll to detect user scrolling and show/hide scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const container = scrollAreaRef.current;
      const threshold = 100;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - threshold;

      // Track if user scrolled away from bottom
      userScrolledUp.current = !isNearBottom;
      setShowScrollToBottom(!isNearBottom && messages.length > 0);
    }
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      // Reset the flag so auto-scroll resumes
      userScrolledUp.current = false;
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !providerModel) return;

    const messageContent = input.trim();
    setInput('');

    // Focus immediately so user can keep typing
    textareaRef.current?.focus();

    await sendMessage(messageContent, providerModel);
  }, [input, isLoading, providerModel, sendMessage]);

  // Refocus textarea when AI finishes responding
  useEffect(() => {
    if (!isLoading && isOpen && messages.length > 0) {
      textareaRef.current?.focus();
    }
  }, [isLoading, isOpen, messages.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isMobile]);

  // For non-embedded mode: Don't render if disabled or not open
  if (!embedded && (config.globalChatEnabled === false || !isOpen)) {
    return null;
  }

  // For non-embedded mode: Don't render on settings pages
  if (!embedded && location.pathname.startsWith('/settings')) {
    return null;
  }

  const hasProviders = settings.providers.length > 0;

  // Embedded mode: Render inline without fixed positioning
  if (embedded) {
    // Hide header when there's a mode toggle (mobile view with switching)
    const showHeader = !mobileChatMode;

    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header - hidden when mobile toggle is present */}
        {showHeader && (
          <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <h2 className="font-semibold text-lg">{t('globalChat')}</h2>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={clearMessages}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('clearChat')}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground px-8 py-12">
              <div>
                <p className="text-lg font-medium mb-2">{t('globalChatWelcome')}</p>
                <p className="text-sm">{t('globalChatDescription')}</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="secondary"
            className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex flex-col rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={hasProviders ? t('typeMessage') : t('configureAIFirst')}
              disabled={!hasProviders || isLoading}
              className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
              rows={1}
              style={{
                height: 'auto',
                minHeight: '96px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
            {/* Bottom Controls Row */}
            <div className="flex items-center gap-4 px-2 py-2">
              {/* Mobile Chat Mode Toggle - single button to switch back to building mode */}
              {mobileChatMode && onMobileChatModeChange && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onMobileChatModeChange('building')}
                    >
                      <Hammer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('building')}</TooltipContent>
                </Tooltip>
              )}

              {/* Model Selector */}
              <div className="flex-1 max-w-72 ml-auto overflow-hidden">
                <ModelSelector
                  value={providerModel}
                  onChange={setProviderModel}
                  disabled={isLoading}
                  placeholder={t('chooseModel')}
                />
              </div>

              {/* Send/Stop Button */}
              {isLoading ? (
                <Button
                  onClick={stopGeneration}
                  size="sm"
                  variant="ghost"
                  className="size-8 rounded-full p-0 bg-foreground/10 [&_svg]:size-3.5 [&_svg]:fill-foreground hover:bg-foreground/20"
                >
                  <Square />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  size="sm"
                  disabled={!input.trim() || !providerModel || !hasProviders}
                  className="size-8 [&_svg]:size-5 rounded-full p-0"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile: Full screen drawer from bottom
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h2 className="font-semibold text-lg">{t('globalChat')}</h2>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={clearMessages}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('clearChat')}</TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground px-8 py-12">
              <div>
                <p className="text-lg font-medium mb-2">{t('globalChatWelcome')}</p>
                <p className="text-sm">{t('globalChatDescription')}</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="secondary"
            className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-background space-y-3 pb-safe">
          <div className="flex gap-2">
            <ModelSelector
              value={providerModel}
              onChange={setProviderModel}
              className="flex-1"
              disabled={isLoading}
              placeholder={t('chooseModel')}
            />
          </div>
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={hasProviders ? t('typeMessage') : t('configureAIFirst')}
              disabled={!hasProviders || isLoading}
              className="resize-none min-h-[44px] max-h-32"
              rows={1}
            />
            {isLoading ? (
              <Button onClick={stopGeneration} size="icon" variant="destructive" className="h-11 w-11 shrink-0">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                size="icon"
                disabled={!input.trim() || !providerModel || !hasProviders}
                className="h-11 w-11 shrink-0"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Floating panel
  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-background border rounded-2xl shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold">{t('globalChat')}</h2>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearMessages}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('clearChat')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('minimizeChat')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96 min-h-48"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center text-center text-muted-foreground px-4 py-8">
            <div>
              <p className="font-medium mb-1">{t('globalChatWelcome')}</p>
              <p className="text-xs">{t('globalChatDescription')}</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollToBottom && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2">
          <Button
            onClick={scrollToBottom}
            size="sm"
            variant="secondary"
            className="h-7 w-7 rounded-full shadow-lg p-0"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t space-y-2">
        <ModelSelector
          value={providerModel}
          onChange={setProviderModel}
          className="w-full"
          disabled={isLoading}
          placeholder={t('chooseModel')}
        />
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 96) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder={hasProviders ? t('typeMessage') : t('configureAIFirst')}
            disabled={!hasProviders || isLoading}
            className="resize-none min-h-[40px] max-h-24 text-sm"
            rows={1}
          />
          {isLoading ? (
            <Button onClick={stopGeneration} size="icon" variant="destructive" className="h-10 w-10 shrink-0">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              size="icon"
              disabled={!input.trim() || !providerModel || !hasProviders}
              className="h-10 w-10 shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
