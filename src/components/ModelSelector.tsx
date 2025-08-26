import { useState, useMemo } from 'react';
import { Check, ChevronDown, Edit3, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function ModelSelector({
  value,
  onChange,
  className,
  disabled = false,
  placeholder = "Select or enter a model...",
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const { settings, addRecentlyUsedModel } = useAISettings();
  const { models, isLoading, error, refetch } = useProviderModels();

  const recentlyUsedModels = useMemo(() => settings.recentlyUsedModels || [], [settings.recentlyUsedModels]);

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, typeof models> = {};
    for (const model of models) {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    }
    return groups;
  }, [models]);

  // Don't auto-initialize with recently used models
  // Let the parent component handle initialization

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === '__custom__') {
      setIsCustomInput(true);
      setCustomValue(value);
      setOpen(false);
      return;
    }

    onChange(selectedValue);
    addRecentlyUsedModel(selectedValue);
    setOpen(false);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      addRecentlyUsedModel(customValue.trim());
      setIsCustomInput(false);
      setCustomValue('');
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomSubmit();
    } else if (e.key === 'Escape') {
      setIsCustomInput(false);
      setCustomValue('');
    }
  };

  if (isCustomInput) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          onBlur={handleCustomSubmit}
          placeholder="provider/model (e.g., openrouter/anthropic/claude-sonnet-4)"
          className="h-8 text-xs"
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={handleCustomSubmit}
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between text-xs border-0 bg-transparent hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground text-right",
            className
          )}
          disabled={disabled}
        >
          <span className="w-full truncate">
            {value || placeholder}
          </span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList className="max-h-[300px]">
            {/* Custom model option - always visible at the top */}
            <CommandGroup>
              <CommandItem
                value="__custom_model_option__"
                onSelect={() => handleSelect('__custom__')}
                className="cursor-pointer"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Enter custom model...
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandEmpty>
              <div className="py-6 text-center text-sm text-muted-foreground">
                <p>No models found.</p>
                <p className="mt-2 text-xs">Try using a custom model instead.</p>
              </div>
            </CommandEmpty>

            {recentlyUsedModels.length > 0 && (
              <CommandGroup heading="Recently Used">
                {recentlyUsedModels.map((model) => (
                  <CommandItem
                    key={model}
                    value={model}
                    onSelect={() => handleSelect(model)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{model}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {recentlyUsedModels.length > 0 && <CommandSeparator />}

            {/* Loading state */}
            {isLoading && (
              <CommandGroup heading="Loading Models...">
                <div className="px-2 py-1.5">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CommandGroup>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <CommandGroup heading="Error Loading Models">
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-destructive">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={refetch}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              </CommandGroup>
            )}

            {/* Provider models */}
            {!isLoading && Object.entries(modelsByProvider).map(([provider, providerModels]) => (
              <div key={provider}>
                <CommandSeparator />
                <CommandGroup heading={provider}>
                  {providerModels.map((model) => (
                    <CommandItem
                      key={model.fullId}
                      value={model.fullId}
                      onSelect={() => handleSelect(model.fullId)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === model.fullId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{model.fullId}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}