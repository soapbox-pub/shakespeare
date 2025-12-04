import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { useAppContext } from '@/hooks/useAppContext';
import { cn } from '@/lib/utils';

export function FloatingChatButton() {
  const { isOpen, setIsOpen, isPoppedOut, messages } = useGlobalChat();
  const { config } = useAppContext();

  // Don't render if disabled in settings or if popped out
  if (config.globalChatEnabled === false || isPoppedOut) {
    return null;
  }

  return (
    <Button
      onClick={() => setIsOpen(!isOpen)}
      size="lg"
      className={cn(
        'fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg',
        'bg-primary hover:bg-primary/90 text-primary-foreground',
        'transition-all duration-200 hover:scale-105',
        'flex items-center justify-center p-0',
        isOpen && 'ring-2 ring-ring ring-offset-2'
      )}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      <MessageCircle className="h-6 w-6" />
      {/* Unread indicator */}
      {!isOpen && messages.length > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
          {messages.length > 9 ? '9+' : messages.length}
        </span>
      )}
    </Button>
  );
}
