import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { useAppContext } from '@/hooks/useAppContext';
import { cn } from '@/lib/utils';

export function FloatingChatButton() {
  const { isOpen, setIsOpen, isPoppedOut, hasUnread } = useGlobalChat();
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
      {/* Unread indicator - small dot when there are unread messages */}
      {!isOpen && hasUnread && (
        <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-destructive ring-2 ring-background" />
      )}
    </Button>
  );
}
