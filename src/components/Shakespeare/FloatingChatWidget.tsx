import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSquare, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatPane, type ChatPaneRef } from '@/components/Shakespeare/ChatPane';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { ProjectPreviewConsoleError } from '@/lib/consoleMessages';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';

interface FloatingChatWidgetProps {
  projectId: string;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  onNewChat: () => void;
  onFirstInteraction?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  consoleError?: ProjectPreviewConsoleError | null;
  onDismissConsoleError?: () => void;
}

interface ChatSize {
  width: number;
  height: number;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 380;
const MAX_WIDTH = 720;
const MAX_HEIGHT = 900;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;

export function FloatingChatWidget({
  projectId,
  isMinimized,
  onToggleMinimize,
  onClose,
  onNewChat,
  onFirstInteraction,
  onLoadingChange,
  isLoading,
  isBuildLoading,
  consoleError,
  onDismissConsoleError,
}: FloatingChatWidgetProps) {
  const chatPaneRef = useRef<ChatPaneRef>(null);
  const [size, setSize] = useLocalStorage<ChatSize>('shk:floatingChatSize', {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Handle keyboard escape to minimize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isMinimized) {
        onToggleMinimize();
      }
    };

    if (!isMinimized) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMinimized, onToggleMinimize]);

  // Resize handlers
  const startResize = useCallback((e: React.PointerEvent, direction: 'right' | 'bottom' | 'top' | 'bottomLeft' | 'topRight') => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    setIsResizing(true);
    document.body.style.userSelect = 'none';
    
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizeStartRef.current) return;

      const maxW = Math.min(MAX_WIDTH, window.innerWidth - 16);
      const maxH = Math.min(MAX_HEIGHT, window.innerHeight - 16);

      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      // Handle horizontal resizing (left edge for bottom-right anchored widget)
      if (direction === 'right' || direction === 'bottomLeft' || direction === 'topRight') {
        const deltaX = resizeStartRef.current.x - moveEvent.clientX;
        newWidth = Math.max(MIN_WIDTH, Math.min(maxW, resizeStartRef.current.width + deltaX));
      }

      // Handle vertical resizing from bottom (grows downward)
      if (direction === 'bottom' || direction === 'bottomLeft') {
        const deltaY = resizeStartRef.current.y - moveEvent.clientY;
        newHeight = Math.max(MIN_HEIGHT, Math.min(maxH, resizeStartRef.current.height + deltaY));
      }

      // Handle vertical resizing from top (grows upward, widget anchored at bottom)
      if (direction === 'top' || direction === 'topRight') {
        const deltaY = moveEvent.clientY - resizeStartRef.current.y;
        newHeight = Math.max(MIN_HEIGHT, Math.min(maxH, resizeStartRef.current.height - deltaY));
      }

      setSize({ width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      resizeStartRef.current = null;
      
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [size, setSize]);

  if (isMinimized) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          onClick={onToggleMinimize}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
          aria-label="Open chat"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50",
        "rounded-lg border shadow-2xl bg-background",
        "flex flex-col overflow-hidden",
        isResizing && "select-none"
      )}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        maxWidth: '92vw',
        maxHeight: '70vh',
      }}
    >
      {/* Header - Styled like ProjectSidebar */}
      <div className="h-12 px-4 border-b flex-shrink-0 flex items-center justify-between bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur">
        <div className="flex items-center gap-2">
          <ShakespeareLogo className="w-5 h-5" />
          <h2 className="text-base font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Shakespeare
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={onToggleMinimize}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Minimize chat"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Close floating chat"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full">
          <ChatPane
            ref={chatPaneRef}
            projectId={projectId}
            onNewChat={onNewChat}
            onFirstInteraction={onFirstInteraction}
            onLoadingChange={onLoadingChange}
            isLoading={isLoading}
            isBuildLoading={isBuildLoading}
            consoleError={consoleError}
            onDismissConsoleError={onDismissConsoleError}
          />
        </div>
      </div>

      {/* Resize Handles */}
      {/* Left edge (appears as "right" from widget perspective, but it's on the left side) */}
      <div
        className="absolute top-0 left-0 h-full w-2 cursor-ew-resize hover:bg-primary/10 active:bg-primary/20 transition-colors"
        onPointerDown={(e) => startResize(e, 'right')}
        style={{ touchAction: 'none' }}
      />
      
      {/* Top edge */}
      <div
        className="absolute top-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/10 active:bg-primary/20 transition-colors"
        onPointerDown={(e) => startResize(e, 'top')}
        style={{ touchAction: 'none' }}
      />
      
      {/* Bottom edge */}
      <div
        className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/10 active:bg-primary/20 transition-colors"
        onPointerDown={(e) => startResize(e, 'bottom')}
        style={{ touchAction: 'none' }}
      />
      
      {/* Bottom-left corner */}
      <div
        className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onPointerDown={(e) => startResize(e, 'bottomLeft')}
        style={{ touchAction: 'none' }}
      />
      
      {/* Top-right corner */}
      <div
        className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        onPointerDown={(e) => startResize(e, 'topRight')}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
