import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface FileUploadAreaProps {
  selectedFile: File | null;
  isDragOver: boolean;
  isValid: boolean;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  disabled?: boolean;
  accept?: string;
  className?: string;
  children?: React.ReactNode;
}

export function FileUploadArea({
  selectedFile,
  isDragOver,
  isValid,
  onFileSelect,
  onFileRemove,
  onDragOver,
  onDragLeave,
  onDrop,
  disabled = false,
  accept = '.zip',
  className,
  children
}: FileUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
        isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
        selectedFile && isValid && "border-green-500/50 bg-green-500/5",
        selectedFile && !isValid && "border-destructive/50 bg-destructive/5",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={!disabled ? handleClickUpload : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
        disabled={disabled}
      />

      {children || (
        <div className="space-y-3">
          <div className="flex justify-center">
            {selectedFile ? (
              isValid ? (
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            )}
          </div>

          <div>
            {selectedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove();
                  }}
                  className="text-xs text-destructive hover:underline"
                  disabled={disabled}
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drop file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  {accept === '.zip' ? 'ZIP files only' : `Accepted files: ${accept}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}