import { useState, useMemo, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Edit3, RefreshCw, AlertCircle, Settings, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useIsMobile } from '@/hooks/useIsMobile';
import { ModelPricing } from '@/components/ModelPricing';
import { cn } from '@/lib/utils';

// Type for model (matches ProviderModel from useProviderModels)
type ModelType = {
  id: string;
  name?: string;
  provider: string;
  fullId: string;
  description?: string;
  contextLength?: number;
  pricing?: {
    prompt: any;
    completion: any;
  };
};

// Interface for grouped models by provider
interface ModelGroup {
  provider: string;
  models: ModelType[];
}

// Parse model ID into components (provider/company/model or provider/model)
function parseModelId(fullId: string) {
  const parts = fullId.split('/');
  return {
    provider: parts[0] || '',
    company: parts.length >= 3 ? parts[1] : null,
    modelName: parts.length >= 3 ? parts.slice(2).join('/') : parts[1] || '',
  };
}

// Group models by provider and sort
function groupModelsByProvider(models: ModelType[], excludeIds: Set<string>): ModelGroup[] {
  const groups: Record<string, ModelType[]> = {};

  // Group by provider
  models.forEach(model => {
    if (!excludeIds.has(model.fullId)) {
      const { provider } = parseModelId(model.fullId);
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    }
  });

  // Sort models within each group and convert to array
  return Object.entries(groups)
    .map(([provider, models]) => ({
      provider,
      models: models.sort((a, b) => {
        const aParsed = parseModelId(a.fullId);
        const bParsed = parseModelId(b.fullId);
        // Sort by company, then model name
        if (aParsed.company && bParsed.company) {
          const diff = aParsed.company.localeCompare(bParsed.company);
          if (diff !== 0) return diff;
        }
        return aParsed.modelName.localeCompare(bParsed.modelName);
      }),
    }))
    .sort((a, b) => {
      // Shakespeare first, then alphabetical
      if (a.provider === 'shakespeare') return -1;
      if (b.provider === 'shakespeare') return 1;
      return a.provider.localeCompare(b.provider);
    });
}

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Render a model item in the list
const ModelItem = memo(({ model, currentValue, onSelect }: {
  model: ModelType;
  currentValue: string;
  onSelect: (value: string) => void;
}) => {
  const parsed = parseModelId(model.fullId);
  const displayText = parsed.company 
    ? `${parsed.company}/${parsed.modelName}`
    : parsed.modelName;

  return (
    <CommandItem
      key={model.fullId}
      value={model.fullId}
      keywords={[model.fullId]}
      onSelect={() => onSelect(model.fullId)}
      className="cursor-pointer"
      title={model.fullId}
    >
      <Check
        className={cn(
          "mr-2 h-4 w-4 shrink-0",
          currentValue === model.fullId ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="flex-1 min-w-0 truncate">
        {displayText}
      </span>
      {model.pricing && (
        <ModelPricing pricing={model.pricing} className="ml-2 shrink-0" />
      )}
    </CommandItem>
  );
});

export const ModelSelector = memo(function ModelSelector({
  value,
  onChange,
  className,
  disabled = false,
  placeholder,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ModelSelectorProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  // Use controlled state if provided, otherwise use local state
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = setControlledOpen || setUncontrolledOpen;

  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const { settings, addRecentlyUsedModel, isConfigured } = useAISettings();
  const { models, isLoading, error, refetch } = useProviderModels();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const defaultPlaceholder = t('selectOrEnterModel');

  const recentlyUsedModels = useMemo(() => settings.recentlyUsedModels || [], [settings.recentlyUsedModels]);

  // Create a Set of recently used model IDs for efficient lookup
  const recentlyUsedSet = useMemo(() => new Set(recentlyUsedModels), [recentlyUsedModels]);

  // Group models by provider
  const modelGroups = useMemo(() => 
    groupModelsByProvider(models, recentlyUsedSet),
    [models, recentlyUsedSet]
  );

  // Determine if we should show the "Recently Used" section
  const shouldShowRecentlyUsed = useMemo(() => {
    // If no recently used models, don't show the section
    if (recentlyUsedModels.length === 0) {
      return false;
    }

    // If there are 5 or more total provider models, always show recently used
    if (models.length >= 5) {
      return true;
    }

    // If less than 5 total provider models, check if all recently used models
    // are contained within the available provider models
    const availableModelIds = new Set(models.map(model => model.fullId));
    const allRecentlyUsedAreAvailable = recentlyUsedModels.every(model =>
      availableModelIds.has(model)
    );

    // Hide recently used section if all recently used models are already available
    return !allRecentlyUsedAreAvailable;
  }, [recentlyUsedModels, models]);

  // Group recently used models (same structure as available models)
  const recentlyUsedGroups = useMemo(() => {
    if (!shouldShowRecentlyUsed) return [];
    const recentModels = recentlyUsedModels
      .map(id => models.find(m => m.fullId === id))
      .filter((m): m is ModelType => m !== undefined);
    return groupModelsByProvider(recentModels, new Set());
  }, [recentlyUsedModels, models, shouldShowRecentlyUsed]);

  // Check if the current model is free
  const isCurrentModelFree = useMemo(() => {
    if (!value) return false;

    const currentModel = models.find(model => model.fullId === value);
    if (!currentModel?.pricing) return false;

    return currentModel.pricing.prompt.equals(0) && currentModel.pricing.completion.equals(0);
  }, [value, models]);

  // Check if the current model is not in the provider's model list
  const isCurrentModelNotInList = useMemo(() => {
    if (!value) return false;
    if (isLoading) return false; // Don't show warning while loading
    if (models.length === 0) return false; // Don't show warning if no models loaded

    const currentModel = models.find(model => model.fullId === value);
    return !currentModel;
  }, [value, models, isLoading]);

  // Determine if we should show the warning icon
  const shouldShowWarning = isCurrentModelFree || isCurrentModelNotInList;

  // Get the warning message
  const warningMessage = useMemo(() => {
    if (isCurrentModelNotInList) {
      return "This model is not available in your provider's model list. It may not work or may have been deprecated.";
    }
    if (isCurrentModelFree) {
      return "You are using a free model. For better results, switch to a paid model.";
    }
    return "";
  }, [isCurrentModelNotInList, isCurrentModelFree]);

  // Don't auto-initialize with recently used models
  // Let the parent component handle initialization

  // Close tooltip when clicking outside on mobile
  useEffect(() => {
    if (!isMobile || !isTooltipOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      // Check if the click is outside the tooltip and trigger
      if (!target.closest('[data-radix-tooltip-content]') &&
          !target.closest('[data-radix-tooltip-trigger]') &&
          !target.closest('[data-testid="triangle-alert"]')) {
        setIsTooltipOpen(false);
      }
    };

    // Add both click and touch event listeners
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isMobile, isTooltipOpen]);

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === '__custom__') {
      setIsCustomInput(true);
      setCustomValue(value);
      setOpen(false);
      return;
    }

    if (selectedValue === '__manage_providers__') {
      navigate('/settings/ai');
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
      <TooltipProvider>
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
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("flex justify-end gap-0.5", className)}>
        {shouldShowWarning && (
          <Tooltip
            open={isMobile ? isTooltipOpen : undefined}
            onOpenChange={isMobile ? setIsTooltipOpen : undefined}
            delayDuration={isMobile ? 0 : 700}
            disableHoverableContent={isMobile}
          >
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center p-0 rounded-none border-0 bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:border-0 active:outline-none"
                aria-label="Model warning"
                tabIndex={isMobile ? 0 : -1}
                onClick={isMobile ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsTooltipOpen(!isTooltipOpen);
                } : undefined}
                onTouchStart={isMobile ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                } : undefined}
                onTouchEnd={isMobile ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsTooltipOpen(!isTooltipOpen);
                } : undefined}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  outline: 'none',
                  border: 'none',
                  boxShadow: 'none'
                }}
              >
                <TriangleAlert className="h-3 w-3 text-amber-500 flex-shrink-0" data-testid="triangle-alert" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={4}
              className="max-w-xs text-center"
              avoidCollisions={true}
              collisionPadding={8}
            >
              <p>{warningMessage}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "h-8 p-0 gap-0.5 text-xs border-0 bg-transparent hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-muted-foreground text-right min-w-0 max-w-[280px]"
              )}
              disabled={disabled}
            >
              <span className="truncate">
                {value || placeholder || defaultPlaceholder}
              </span>
              <ChevronDown className="size-3 shrink-0 opacity-50" />
            </Button>
          </DialogTrigger>
          <DialogContent 
            className={cn(
              "p-0 max-w-[90vw] sm:max-w-lg md:max-w-2xl",
              "max-h-[85vh] overflow-hidden flex flex-col"
            )}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command 
              className="flex flex-col h-full overflow-hidden"
              filter={(value, search, keywords) => {
                // Substring search: match if search appears anywhere in value or keywords
                const s = search.toLowerCase();
                if (value.toLowerCase().includes(s)) return 1;
                if (keywords?.some(k => typeof k === 'string' && k.toLowerCase().includes(s))) return 1;
                return 0;
              }}
            >
              {(isConfigured && models.length >= 5) && (
                <CommandInput placeholder={t('searchModels')} className="h-9" autoFocus={false} />
              )}
              <CommandList className="flex-1 overflow-y-auto overflow-x-hidden">
                <CommandEmpty>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <p>{t('noModelsFound')}</p>
                    <p className="mt-2 text-xs">{t('tryCustomModel')}</p>
                  </div>
                </CommandEmpty>

                {/* Recently Used section */}
                {shouldShowRecentlyUsed && (
                  <>
                    <CommandGroup heading={t('recentlyUsed')} />
                    {recentlyUsedGroups.map((group) => (
                      <CommandGroup key={`recent-${group.provider}`} heading={group.provider}>
                        {group.models.map((model) => (
                          <ModelItem
                            key={model.fullId}
                            model={model}
                            currentValue={value}
                            onSelect={handleSelect}
                          />
                        ))}
                      </CommandGroup>
                    ))}
                    {modelGroups.length > 0 && <CommandSeparator />}
                  </>
                )}

                {/* Available Models section */}
                {!isLoading && modelGroups.length > 0 && (
                  <CommandGroup heading="Available Models" />
                )}

                {/* Loading state */}
                {isLoading && (
                  <CommandGroup heading={t('loading')}>
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
                  <CommandGroup heading={t('errorLoadingModels')}>
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
                            {t('retry')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CommandGroup>
                )}

                {/* Provider models */}
                {!isLoading && modelGroups.map((group) => (
                  <CommandGroup key={group.provider} heading={group.provider}>
                    {group.models.map((model) => (
                      <ModelItem
                        key={model.fullId}
                        model={model}
                        currentValue={value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </CommandGroup>
                ))}

                {/* Custom model option and manage providers - moved to bottom */}
                <CommandSeparator />
                <CommandGroup>
                  {isConfigured && (
                    <CommandItem
                      value="__custom_model_option__"
                      onSelect={() => handleSelect('__custom__')}
                      className="cursor-pointer"
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      {t('enterCustomModel')}
                    </CommandItem>
                  )}
                  <CommandItem
                    value="__manage_providers_option__"
                    onSelect={() => handleSelect('__manage_providers__')}
                    className="cursor-pointer"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {t('manageProviders')}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
});