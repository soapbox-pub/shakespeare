import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { cn } from '@/lib/utils';

interface ModelInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  inputModalities?: string[];
  outputModalities?: string[];
}

export function ModelInput({
  value,
  onChange,
  className,
  placeholder,
  inputModalities,
  outputModalities,
}: ModelInputProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { settings } = useAISettings();
  const { models } = useProviderModels();

  const defaultPlaceholder = 'Select a model...';

  // Filter models by modalities
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      // Filter by input modalities if specified
      if (inputModalities && model.inputModalities) {
        return inputModalities.every((modality) => model.inputModalities!.includes(modality));
      }
      // Filter by output modalities if specified
      if (outputModalities && model.outputModalities) {
        return outputModalities.every((modality) => model.outputModalities!.includes(modality));
      }
      return true;
    });
  }, [models, inputModalities, outputModalities]);

  console.log({ models, filteredModels });

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, typeof filteredModels> = {};
    for (const model of filteredModels) {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    }
    return groups;
  }, [filteredModels]);

  // Get provider display name and baseURL for a given provider ID
  const getProviderInfo = useMemo(() => {
    return (providerId: string) => {
      const provider = settings.providers.find(p => p.id === providerId);
      return {
        displayName: provider ? provider.name : providerId,
        baseURL: provider?.baseURL,
      };
    };
  }, [settings.providers]);

  // Get display info for the selected model
  const selectedModelDisplay = useMemo(() => {
    if (!value) return null;

    const providerId = value.split('/')[0];
    const modelId = value.split('/').slice(1).join('/') || value;
    const providerInfo = getProviderInfo(providerId);
    const modelData = filteredModels.find(m => m.fullId === value);
    const displayName = modelData?.name || modelId;

    return {
      displayName,
      baseURL: providerInfo.baseURL,
    };
  }, [value, getProviderInfo, filteredModels]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10",
            !value && "text-muted-foreground",
            className
          )}
        >
          {selectedModelDisplay ? (
            <div className="flex items-center gap-2 min-w-0">
              {selectedModelDisplay.baseURL ? (
                <ExternalFavicon
                  url={selectedModelDisplay.baseURL}
                  size={16}
                  fallback={<Bot size={16} />}
                  className="flex-shrink-0"
                />
              ) : (
                <Bot size={16} className="flex-shrink-0" />
              )}
              <span className="truncate">
                {selectedModelDisplay.displayName}
              </span>
            </div>
          ) : (
            <span className="truncate">
              {placeholder || defaultPlaceholder}
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('searchModels')} className="h-9" />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm text-muted-foreground">
                <p>{t('noModelsFound')}</p>
              </div>
            </CommandEmpty>

            {/* Provider models */}
            {Object.entries(modelsByProvider).map(([providerId, providerModels], index) => {
              const providerInfo = getProviderInfo(providerId);

              return (
                <div key={providerId}>
                  {index > 0 && <CommandSeparator />}
                  <CommandGroup heading={providerInfo.displayName}>
                    {providerModels.map((model) => (
                      <CommandItem
                        key={model.fullId}
                        value={model.fullId}
                        onSelect={() => handleSelect(model.fullId)}
                        className="cursor-pointer"
                      >
                        {providerInfo.baseURL ? (
                          <ExternalFavicon
                            url={providerInfo.baseURL}
                            size={16}
                            fallback={<Bot size={16} />}
                            className="mr-2 flex-shrink-0"
                          />
                        ) : (
                          <Bot size={16} className="mr-2 flex-shrink-0" />
                        )}
                        <span className="truncate flex-1">{model.name || model.id}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
