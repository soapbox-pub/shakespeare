import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VFSImage } from '@/components/VFSImage';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

/** Distance (px) a swipe must travel to dismiss the lightbox. */
const DISMISS_DISTANCE = 120;
/** Speed (px/ms) above which a shorter flick also dismisses. */
const DISMISS_VELOCITY = 0.5;

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const touch = useRef<{ startY: number; lastY: number; lastTime: number; velocity: number } | null>(null);

  useEffect(() => {
    setDragY(0);
    setDragging(false);
    setDismissing(false);
  }, [imageUrl]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || dismissing) return;
    const y = e.touches[0].clientY;
    touch.current = { startY: y, lastY: y, lastTime: e.timeStamp, velocity: 0 };
    setDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = touch.current;
    if (!t || e.touches.length !== 1) return;
    const y = e.touches[0].clientY;
    const dt = e.timeStamp - t.lastTime;
    if (dt > 0) t.velocity = (y - t.lastY) / dt;
    t.lastY = y;
    t.lastTime = e.timeStamp;
    setDragY(y - t.startY);
  };

  const handleTouchEnd = () => {
    const t = touch.current;
    if (!t) return;
    touch.current = null;
    setDragging(false);

    const dy = t.lastY - t.startY;
    const flicked = Math.abs(t.velocity) > DISMISS_VELOCITY && Math.sign(t.velocity) === Math.sign(dy);
    if (Math.abs(dy) > DISMISS_DISTANCE || (flicked && Math.abs(dy) > 20)) {
      setDismissing(true);
      setDragY(Math.sign(dy) * window.innerHeight);
      setTimeout(onClose, 200);
    } else {
      setDragY(0);
    }
  };

  // Fade the backdrop as the image is dragged away
  const progress = Math.min(Math.abs(dragY) / (DISMISS_DISTANCE * 3), 1);

  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay
          className={cn('bg-black/95', !dragging && 'transition-opacity duration-200')}
          style={{ opacity: 1 - progress }}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-safe-offset-4 bg-transparent border-0 shadow-none touch-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onEscapeKeyDown={onClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {imageUrl && (
            <>
              {/* Clickable background to close */}
              <div
                className="absolute inset-0 cursor-pointer z-[1]"
                onClick={onClose}
                aria-label="Close lightbox"
              />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-safe-offset-4 right-safe-offset-4 z-[3] p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Image */}
              <div
                className={cn(
                  "relative z-[2] flex items-center justify-center w-full h-full pointer-events-none",
                  !dragging && "transition-transform duration-200 ease-out"
                )}
                style={{ transform: `translateY(${dragY}px)` }}
                onClick={(e) => e.stopPropagation()}
              >
                {imageUrl.startsWith('/') ? (
                  <VFSImage
                    path={imageUrl}
                    alt="Expanded image"
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg pointer-events-auto"
                  />
                ) : (
                  <img
                    src={imageUrl}
                    alt="Expanded image"
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg pointer-events-auto"
                  />
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
