import { useState, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CircularProgress } from '@/components/ui/circular-progress';
import { FileAttachment } from '@/components/ui/file-attachment';
import { Square, ArrowUp } from 'lucide-react';
import { ModelSelector } from '@/components/ModelSelector';

interface ChatInputProps {
  isLoading: boolean;
  isConfigured: boolean;
  providerModel: string;
  onProviderModelChange: (model: string) => void;
  onSend: (input: string, files: File[]) => void;
  onStop: () => void;
  onFocus: () => void;
  onFirstInteraction: () => void;
  isModelSelectorOpen: boolean;
  onModelSelectorOpenChange: (open: boolean) => void;
  contextUsagePercentage: number;
  currentModelContextLength?: number;
  lastInputTokens?: number;
  totalCost: number;
  isDragOver: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const ChatInput = memo(function ChatInput({
  isLoading,
  isConfigured,
  providerModel,
  onProviderModelChange,
  onSend,
  onStop,
  onFocus,
  onFirstInteraction,
  isModelSelectorOpen,
  onModelSelectorOpenChange,
  contextUsagePercentage,
  currentModelContextLength,
  lastInputTokens,
  totalCost,
  isDragOver,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const handleFileSelect = useCallback((file: File) => {
    setAttachedFiles(prev => [...prev, file]);
  }, []);

  const handleFileRemove = useCallback((fileToRemove: File) => {
    setAttachedFiles(prev => prev.filter(file => file !== fileToRemove));
  }, []);

  const handleSend = useCallback(() => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    if (!isConfigured || !providerModel.trim()) return;

    const currentInput = input;
    const currentFiles = [...attachedFiles];

    setInput('');
    setAttachedFiles([]);

    onSend(currentInput, currentFiles);
  }, [input, attachedFiles, isLoading, isConfigured, providerModel, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
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

          // Add to attached files
          setAttachedFiles(prev => [...prev, namedFile]);
        }
        break; // Only handle the first image found
      }
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  return (
    <div className="border-t p-4">
      {/* Chat Input Container */}
      <div
        className={`flex flex-col rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all ${
          isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''
        }`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={onFocus}
          placeholder={
            !isConfigured
              ? t('askToAddFeatures')
              : providerModel.trim()
                ? t('askToAddFeatures')
                : t('selectModelFirst')
          }
          className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
          disabled={isLoading || (isConfigured && !providerModel.trim())}
          rows={1}
          aria-label="Chat message input"
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
          {/* File Attachment */}
          <FileAttachment
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFiles={attachedFiles}
            disabled={isLoading}
            multiple={true}
          />

          {/* Context Usage Wheel */}
          {contextUsagePercentage >= 10 && currentModelContextLength && lastInputTokens && lastInputTokens > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <CircularProgress
                      value={contextUsagePercentage}
                      size={20}
                      strokeWidth={2}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('contextUsage', {
                    tokens: lastInputTokens.toLocaleString(),
                    total: currentModelContextLength.toLocaleString(),
                    percentage: contextUsagePercentage.toFixed(1)
                  })}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Cost Display */}
          {totalCost >= 0.01 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md whitespace-nowrap cursor-help">
                    ${totalCost.toFixed(2)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('totalCostSession')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Model Selector */}
          <div className="flex-1 max-w-72 ml-auto overflow-hidden">
            <ModelSelector
              value={providerModel}
              onChange={onProviderModelChange}
              disabled={isLoading}
              placeholder={t('chooseModel')}
              open={isModelSelectorOpen}
              onOpenChange={onModelSelectorOpenChange}
            />
          </div>

          {/* Send/Stop Button */}
          <div>
            {isLoading ? (
              <Button
                onClick={onStop}
                size="sm"
                variant="ghost"
                className="size-8 rounded-full p-0 bg-foreground/10 [&_svg]:size-3.5 [&_svg]:fill-foreground hover:bg-foreground/20"
              >
                <Square />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                onMouseDown={onFirstInteraction}
                disabled={(!input.trim() && attachedFiles.length === 0) || (isConfigured && !providerModel.trim())}
                size="sm"
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
});
