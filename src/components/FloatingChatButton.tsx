import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalChat } from '@/hooks/useGlobalChat';
import { useAppContext } from '@/hooks/useAppContext';
import { cn } from '@/lib/utils';

export function FloatingChatButton() {
  const { isOpen, setIsOpen, hasUnread } = useGlobalChat();
  const { config } = useAppContext();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isHiddenTemporarily, setIsHiddenTemporarily] = useState(false);

  // Reset hidden state when navigating to a different page
  useEffect(() => {
    setIsHiddenTemporarily(false);
  }, [location.pathname]);

  // Don't render if disabled in settings
  if (config.globalChatEnabled === false) {
    return null;
  }

  // Don't render on settings pages
  if (location.pathname.startsWith('/settings')) {
    return null;
  }

  // Don't render if temporarily hidden
  if (isHiddenTemporarily) {
    return null;
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHiddenTemporarily(true);
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Close button - appears on hover */}
      <Button
        onClick={handleClose}
        size="icon"
        variant="secondary"
        className={cn(
          'absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md border',
          'transition-all duration-200',
          isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
        )}
        aria-label="Hide chat button"
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Main chat button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className={cn(
          'h-14 w-14 rounded-full shadow-lg',
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
    </div>
  );
}
