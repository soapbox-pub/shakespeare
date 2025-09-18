import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileAttachmentProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: (file: File) => void;
  selectedFiles?: File[];
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  className?: string;
}

export function FileAttachment({
  onFileSelect,
  onFileRemove,
  selectedFiles = [],
  disabled = false,
  accept,
  multiple = false,
  className
}: FileAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        onFileSelect(file);
      });
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (file: File) => {
    if (onFileRemove) {
      onFileRemove(file);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleButtonClick}
        disabled={disabled}
        className="h-8 w-8 p-0 rounded-full hover:bg-muted/50"
        aria-label="Attach files"
        data-testid="paperclip-button"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-48">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-md text-xs"
            >
              <span className="truncate max-w-24" title={file.name}>
                {file.name}
              </span>
              {onFileRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(file)}
                  className="h-3 w-3 p-0 hover:bg-muted/70"
                >
                  <X className="h-2 w-2" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}