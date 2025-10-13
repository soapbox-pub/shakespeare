import { useEffect, useRef } from 'react';
import { Check, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAISettings } from '@/hooks/useAISettings';
import { AI_PROVIDER_PRESETS } from '@/lib/aiProviderPresets';
import type { AIProvider } from '@/contexts/AISettingsContext';

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
}

export function AddProviderDialog({ open, onOpenChange, provider }: AddProviderDialogProps) {
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  const { settings, setProvider } = useAISettings();

  // Check if provider already exists and if it's identical
  const existingProvider = settings.providers.find(p => p.id === provider.id);
  const isIdentical = existingProvider &&
    existingProvider.baseURL === provider.baseURL &&
    existingProvider.apiKey === provider.apiKey &&
    existingProvider.nostr === provider.nostr &&
    existingProvider.proxy === provider.proxy;

  // Get provider name from presets or fallback to id
  const getProviderName = () => {
    const preset = AI_PROVIDER_PRESETS.find(
      p => p.id === provider.id && p.baseURL === provider.baseURL
    );
    return preset?.name || provider.id;
  };

  const providerName = getProviderName();

  const handleAddProvider = () => {
    setProvider(provider);
    onOpenChange(false);
  };

  // Scroll to top when dialog opens
  useEffect(() => {
    if (open && scrollableContentRef.current) {
      scrollableContentRef.current.scrollTop = 0;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-dvh-safe sm:h-auto sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">Add Provider</span>
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollableContentRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-6 py-4">
            {isIdentical ? (
              // Provider already exists with identical configuration
              <div className="text-center space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Already Configured</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    You already have {providerName} configured with the same settings.
                  </p>
                </div>
                <Button onClick={() => onOpenChange(false)} className="gap-2">
                  Close
                </Button>
              </div>
            ) : existingProvider ? (
              // Provider exists but with different configuration
              <div className="space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">Provider Already Exists</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    A provider with this ID already exists but with different settings. Would you like to overwrite it?
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="space-y-2 p-4 rounded-lg border">
                    <h3 className="font-semibold text-sm">Current Settings</h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Base URL:</span>
                        <div className="font-mono break-all">{existingProvider.baseURL}</div>
                      </div>
                      {existingProvider.apiKey && (
                        <div>
                          <span className="font-medium">API Key:</span>
                          <div className="font-mono">••••••••</div>
                        </div>
                      )}
                      {existingProvider.nostr && (
                        <div>
                          <span className="font-medium">Nostr Auth:</span> Enabled
                        </div>
                      )}
                      {existingProvider.proxy && (
                        <div>
                          <span className="font-medium">Proxy:</span> Enabled
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-lg border border-primary">
                    <h3 className="font-semibold text-sm">New Settings</h3>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium">Base URL:</span>
                        <div className="font-mono break-all">{provider.baseURL}</div>
                      </div>
                      {provider.apiKey && (
                        <div>
                          <span className="font-medium">API Key:</span>
                          <div className="font-mono">••••••••</div>
                        </div>
                      )}
                      {provider.nostr && (
                        <div>
                          <span className="font-medium">Nostr Auth:</span> Enabled
                        </div>
                      )}
                      {provider.proxy && (
                        <div>
                          <span className="font-medium">Proxy:</span> Enabled
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddProvider} className="gap-2">
                    Overwrite Provider
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              // New provider
              <div className="space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold">{providerName}</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Add {providerName} to your configuration?
                  </p>
                </div>

                <div className="flex justify-center">
                  <Button onClick={handleAddProvider}>
                    Add Provider
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
