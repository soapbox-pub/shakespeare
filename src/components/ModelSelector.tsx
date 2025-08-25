import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useAISettings } from '@/hooks/useAISettings';
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

  const recentlyUsedModels = useMemo(() => settings.recentlyUsedModels || [], [settings.recentlyUsedModels]);

  // Initialize with first recently used model if value is empty
  useEffect(() => {
    if (!value && recentlyUsedModels.length > 0) {
      onChange(recentlyUsedModels[0]);
    }
  }, [value, recentlyUsedModels, onChange]);

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
            "h-8 justify-between text-xs border-0 bg-transparent hover:bg-muted/50 hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>

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

            <CommandGroup>
              <CommandItem
                value="__custom__"
                onSelect={() => handleSelect('__custom__')}
                className="cursor-pointer"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Enter custom model...
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}