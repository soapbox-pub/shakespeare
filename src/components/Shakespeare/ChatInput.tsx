import { useState, useCallback, memo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CircularProgress } from '@/components/ui/circular-progress';
import { FileAttachment } from '@/components/ui/file-attachment';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Square, ArrowUp } from 'lucide-react';
import { ModelSelector } from '@/components/ModelSelector';
import { QueuedMessages } from '@/components/Shakespeare/QueuedMessages';
import { VoiceInputButton } from '@/components/Shakespeare/VoiceInputButton';
import type { QueuedMessage } from '@/lib/SessionManager';
import { readChatDraft, writeChatDraft } from '@/lib/chatDrafts';
import { useDictationInput } from '@/hooks/useDictationInput';

export interface SlashCommand {
  name: string;
  description: string;
  action: () => void;
}

interface ChatInputProps {
  /** The draft is saved per project. Remount (`key`) when this changes. */
  projectId: string;
  isLoading: boolean;
  isConfigured: boolean;
  isLoadingSettings: boolean;
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
  slashCommands?: SlashCommand[];
  queuedMessages?: QueuedMessage[];
  onRemoveQueuedMessage?: (id: string) => void;
}

export const ChatInput = memo(function ChatInput({
  projectId,
  isLoading,
  isConfigured,
  isLoadingSettings,
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
  slashCommands = [],
  queuedMessages = [],
  onRemoveQueuedMessage,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(() => readChatDraft(projectId));
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictationInput({ textareaRef, value: input, onChange: setInput, maxHeight: 128 });
  const { isDictating } = dictation;

  useEffect(() => {
    writeChatDraft(projectId, input);
  }, [projectId, input]);

  // Size the textarea to a restored draft, as typing would
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !textarea.value) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setAttachedFiles(prev => [...prev, file]);
  }, []);

  const handleFileRemove = useCallback((fileToRemove: File) => {
    setAttachedFiles(prev => prev.filter(file => file !== fileToRemove));
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (!isConfigured || !providerModel.trim()) return;
    if (isDictating) return;

    const currentInput = input;
    const currentFiles = [...attachedFiles];

    setInput('');
    setAttachedFiles([]);

    onSend(currentInput, currentFiles);
  }, [input, attachedFiles, isConfigured, providerModel, isDictating, onSend]);

  const hasInput = !!input.trim() || attachedFiles.length > 0;

  const executeSlashCommand = useCallback((command: SlashCommand) => {
    setInput('');
    setShowSlashCommands(false);
    setSelectedCommandIndex(0);
    command.action();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle arrow key navigation when slash commands are showing
    if (showSlashCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }

      // If slash commands are showing and user presses Enter or Tab, select the highlighted command
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        executeSlashCommand(filteredCommands[selectedCommandIndex]);
        return;
      }

      // If slash commands are showing and user presses Escape, close the popover
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashCommands(false);
        setSelectedCommandIndex(0);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, showSlashCommands, filteredCommands, selectedCommandIndex, executeSlashCommand]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check if slash command autocomplete should be shown
    if (value.startsWith('/') && !value.includes(' ') && slashCommands.length > 0) {
      const query = value.slice(1).toLowerCase();
      const filtered = slashCommands.filter(cmd => 
        cmd.name.toLowerCase().includes(query)
      );
      setFilteredCommands(filtered);
      setShowSlashCommands(filtered.length > 0);
      setSelectedCommandIndex(0); // Reset selection when filtering
    } else {
      setShowSlashCommands(false);
      setSelectedCommandIndex(0);
    }
  }, [slashCommands]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Call parent's drop handler for visual state management
    onDrop(e);
    
    // Extract files from the drop event
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Add all files without validation
    setAttachedFiles(prev => [...prev, ...files]);
  }, [onDrop]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showSlashCommands) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside the popover and textarea
      const target = e.target as Node;
      if (textareaRef.current && !textareaRef.current.contains(target)) {
        setShowSlashCommands(false);
      }
    };

    // Use a slight delay to avoid closing immediately on focus
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showSlashCommands]);

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
        onDrop={handleDrop}
      >
        {onRemoveQueuedMessage && (
          <QueuedMessages messages={queuedMessages} onRemove={onRemoveQueuedMessage} />
        )}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPasteImage={(file) => setAttachedFiles(prev => [...prev, file])}
            onFocus={onFocus}
            placeholder={
              !isConfigured
                ? t('askToAddFeatures')
                : !providerModel.trim()
                  ? t('selectModelFirst')
                  : isLoading
                    ? t('queueMessage')
                    : t('askToAddFeatures')
            }
            className="flex-1 resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            disabled={isLoadingSettings || (isConfigured && !providerModel.trim())}
            readOnly={isDictating}
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
          {showSlashCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border bg-popover p-0 text-popover-foreground shadow-md z-50">
              <Command value={filteredCommands[selectedCommandIndex]?.name}>
                <CommandList>
                  <CommandGroup>
                    {filteredCommands.map((command) => (
                      <CommandItem
                        key={command.name}
                        value={command.name}
                        onSelect={() => executeSlashCommand(command)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="font-medium">/{command.name}</div>
                          <div className="text-xs text-muted-foreground">{command.description}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
        </div>

        {/* Bottom Controls Row */}
        <div className="flex items-center gap-4 px-2 py-2">
          {/* File Attachment and Voice Input */}
          <FileAttachment
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            selectedFiles={attachedFiles}
            disabled={isLoadingSettings}
            multiple={true}
          >
            <VoiceInputButton
              onStart={dictation.onStart}
              onText={dictation.onText}
              onEnd={dictation.onEnd}
              disabled={isLoadingSettings || (isConfigured && !providerModel.trim())}
            />
          </FileAttachment>

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
              disabled={isLoadingSettings}
              placeholder={t('chooseModel')}
              open={isModelSelectorOpen}
              onOpenChange={onModelSelectorOpenChange}
            />
          </div>

          {/* Send/Stop Button. While the AI works, sending queues the message for the end of its turn. */}
          <div className="flex items-center gap-2">
            {isLoading && (
              <Button
                onClick={onStop}
                size="sm"
                variant="ghost"
                className="size-8 rounded-full p-0 bg-foreground/10 [&_svg]:size-3.5 [&_svg]:fill-foreground hover:bg-foreground/20"
              >
                <Square />
              </Button>
            )}
            {(!isLoading || hasInput) && (
              <Button
                onClick={handleSend}
                onMouseDown={onFirstInteraction}
                disabled={isLoadingSettings || !hasInput || isDictating || (isConfigured && !providerModel.trim())}
                size="sm"
                className="size-8 [&_svg]:size-5 rounded-full p-0"
                aria-label={isLoading ? t('sendAfterTurn') : undefined}
                title={isLoading ? t('sendAfterTurn') : undefined}
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
