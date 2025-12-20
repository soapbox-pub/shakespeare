import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Callback fired when an image is pasted into the textarea.
   * If both onPaste and onPasteImage are provided, onPaste takes precedence.
   */
  onPasteImage?: (file: File) => void;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onPaste, onPasteImage, ...props }, ref) => {
    const handlePaste = React.useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        // If onPaste is provided, use it and skip image handling
        if (onPaste) {
          onPaste(e);
          return;
        }

        // If onPasteImage is provided, handle image pasting
        if (onPasteImage) {
          const items = e.clipboardData?.items;
          if (!items) return;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Check if the item is an image
            if (item.type.startsWith('image/')) {
              e.preventDefault(); // Prevent default paste behavior for images

              const file = item.getAsFile();
              if (file) {
                // Generate a filename with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = file.type.split('/')[1] || 'png';
                const filename = `pasted-image-${timestamp}.${extension}`;

                // Create a new File object with the generated name
                const namedFile = new File([file], filename, { type: file.type });

                // Call the onPasteImage callback
                onPasteImage(namedFile);
              }
              break; // Only handle the first image found
            }
          }
        }
      },
      [onPaste, onPasteImage]
    );

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onPaste={onPaste || onPasteImage ? handlePaste : undefined}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
