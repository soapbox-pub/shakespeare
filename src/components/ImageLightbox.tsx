import { X } from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VFSImage } from '@/components/VFSImage';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent border-0 shadow-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onEscapeKeyDown={onClose}
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
                className="absolute top-4 right-4 z-[3] p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Image */}
              <div
                className="relative z-[2] flex items-center justify-center w-full h-full pointer-events-none"
                onClick={(e) => e.stopPropagation()}
              >
                {imageUrl.startsWith('/') ? (
                  <VFSImage
                    path={imageUrl}
                    alt="Expanded image"
                    className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] w-auto h-auto object-contain rounded-lg pointer-events-auto"
                  />
                ) : (
                  <img
                    src={imageUrl}
                    alt="Expanded image"
                    className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] w-auto h-auto object-contain rounded-lg pointer-events-auto"
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
