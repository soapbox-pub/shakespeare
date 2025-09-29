import { Decimal } from 'decimal.js';
import { useState, useEffect, useRef } from 'react';
import { generateSecretKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import { Bot, Check, Sparkles, ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/ui/password-input';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useProviderModels } from '@/hooks/useProviderModels';
import { CreditsDialog } from '@/components/CreditsDialog';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { AI_PROVIDER_PRESETS, type PresetProvider } from '@/lib/aiProviderPresets';
import { cn } from '@/lib/utils';

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OnboardingStep = 'welcome' | 'open-source' | 'provider-selection' | 'model-selection' | 'conclusion';

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<PresetProvider | null>(null);
  const [providerApiKey, setProviderApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Ref for the scrollable content area
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  const { setProvider, addRecentlyUsedModel } = useAISettings();
  const { user } = useCurrentUser();
  const login = useLoginActions();
  const { models, isLoading: isLoadingModels } = useProviderModels();

  // Filter models to only show selected provider models
  const providerModels = selectedProvider
    ? models.filter(model => model.provider === selectedProvider.id)
    : [];

  const handleGetStarted = () => {
    setStep('open-source');
  };

  const handleContinueFromOpenSource = () => {
    if (!agreedToTerms) return;
    setStep('provider-selection');
  };

  const handleProviderSelect = (provider: PresetProvider) => {
    setSelectedProvider(provider);
    // Clear API key when switching providers
    setProviderApiKey('');
  };

  const handleContinueFromProviderSelection = async () => {
    if (!selectedProvider) return;

    // Check if provider requires API key and if it's provided
    const requiresApiKey = selectedProvider.apiKeysURL && !selectedProvider.nostr;
    if (requiresApiKey && !providerApiKey.trim()) return;

    setIsSettingUp(true);

    try {
      // If user is not logged in and provider uses Nostr auth, generate and login with secret key
      if (!user && selectedProvider.nostr) {
        const secretKey = generateSecretKey();
        const nsec = nip19.nsecEncode(secretKey);
        login.nsec(nsec);
      }

      // Add selected provider to their config
      const providerConfig = {
        id: selectedProvider.id,
        baseURL: selectedProvider.baseURL,
        nostr: selectedProvider.nostr || undefined,
        apiKey: requiresApiKey ? providerApiKey.trim() : undefined,
      };
      setProvider(providerConfig);

      // Move to model selection
      setStep('model-selection');
    } catch (error) {
      console.error('Failed to set up user:', error);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleModelSelect = (modelFullId: string) => {
    setSelectedModel(modelFullId);
  };

  const handleContinue = () => {
    if (!selectedModel) return;

    // Add model to recently used
    addRecentlyUsedModel(selectedModel);

    // Find the selected model to check if it's free
    const model = providerModels.find(m => m.fullId === selectedModel);
    const isFreeModel = !model?.pricing || (
      model.pricing.prompt.equals(0) && model.pricing.completion.equals(0)
    );

    if (isFreeModel) {
      // Free model, go straight to conclusion
      setStep('conclusion');
    } else {
      // Paid model, show credits dialog
      setShowCreditsDialog(true);
    }
  };

  const handleCreditsDialogClose = () => {
    setShowCreditsDialog(false);
    setStep('conclusion');
  };

  const handleFinish = () => {
    onOpenChange(false);
  };

  const formatPrice = (price: Decimal | undefined) => {
    if (!price) return 'unknown';
    if (price.equals(0)) return 'Free';
    // Convert from per-token to per-1M tokens and format with $ prefix
    const pricePerMillion = price.times(1_000_000);
    return '$' + pricePerMillion.toFixed(2).toString().replace(/\.00$/, '') + '/M tokens';
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('welcome');
      setSelectedProvider(null);
      setProviderApiKey('');
      setSelectedModel('');
      setIsSettingUp(false);
      setShowCreditsDialog(false);
      setAgreedToTerms(false);
    }
  }, [open]);

  // Scroll to top when step changes
  useEffect(() => {
    if (scrollableContentRef.current) {
      scrollableContentRef.current.scrollTop = 0;
    }
  }, [step]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl h-[100vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {step === 'open-source' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('welcome')}
                  className="mr-2 p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 'provider-selection' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('open-source')}
                  className="mr-2 p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 'model-selection' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('provider-selection')}
                  className="mr-2 p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 'conclusion' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('model-selection')}
                  className="mr-2 p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xl">
                {step === 'model-selection' && 'Choose Your AI Model'}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div ref={scrollableContentRef} className="flex-1 overflow-y-auto min-h-0">
            {step === 'welcome' && (
              <div className="text-center space-y-6 py-4">
                <div className="mb-4">
                  <ShakespeareLogo className="w-16 h-16 mx-auto" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Welcome to Shakespeare!
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    Your AI-powered development assistant for building custom Nostr applications.
                    Simply describe what you want to build, and AI will help you create it.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-lg mx-auto">
                    <div className="text-center space-y-2">
                      <div className="text-2xl">💡</div>
                      <p className="text-sm text-muted-foreground">AI-Powered Development</p>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl">⚡</div>
                      <p className="text-sm text-muted-foreground">Nostr Integration</p>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl">🚀</div>
                      <p className="text-sm text-muted-foreground">Instant Preview</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleGetStarted}
                    disabled={isSettingUp}
                    size="lg"
                    className="gap-2"
                  >
                    {isSettingUp ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Get Started
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'open-source' && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">Shakespeare is Open Source software that runs entirely in your web&nbsp;browser</h2>
                </div>

                <div className="grid gap-1 max-w-md mx-auto">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">Your browser connects directly to third-party AI providers of your choice</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">Your files are stored on your device in your browser</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">Be careful not to delete your browser data or you may lose project files</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">You are responsible for taking backups or syncing to git</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">Quality of output depends on models used and is not guaranteed</p>
                  </div>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  <p className="text-xs text-muted-foreground max-w-xl mx-auto">
                    Shakespeare is not a cloud service. It's Open Source software that runs in your web browser.
                    You agree to the Terms of Service of AI providers you interact with.
                    Shakespeare is provided "as is" without warranty of any kind.
                  </p>

                  <div className="flex items-center justify-center gap-2">
                    <Checkbox
                      id="agree-terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    />
                    <label
                      htmlFor="agree-terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      I agree
                    </label>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleContinueFromOpenSource}
                    disabled={!agreedToTerms}
                    className="gap-2 rounded-full w-full max-w-md"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'provider-selection' && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">Choose your AI provider</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Select an AI provider to power your development assistant. You can add more providers later in settings.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 p-1 gap-3 max-w-4xl mx-auto">
                  {AI_PROVIDER_PRESETS.map((provider) => {
                    const isSelected = selectedProvider?.id === provider.id;
                    const isShakespeare = provider.id === 'shakespeare';

                    return (
                      <Card
                        key={provider.id}
                        className={cn('cursor-pointer transition-all hover:shadow-md', {
                          'ring-2 ring-primary': isSelected,
                        })}
                        onClick={() => handleProviderSelect(provider)}
                      >
                        <div className="flex items-center justify-between p-3">
                          <div className="flex-1">
                            <CardTitle className={`text-lg font-semibold ${isShakespeare ? 'bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent' : ''}`}>
                              {provider.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* API Key Input Section */}
                {selectedProvider && selectedProvider.apiKeysURL && !selectedProvider.nostr && (
                  <div className="space-y-3 max-w-md mx-auto">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold">
                        {selectedProvider.id === 'routstr' ? 'Enter Cashu Token' : 'Enter API Key'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedProvider.id === 'routstr' ? (
                          <>{selectedProvider.name} requires a Cashu token</>
                        ) : (
                          <>
                            {selectedProvider.name} requires an {selectedProvider.apiKeysURL ? (
                              <a className="text-foreground underline" href={selectedProvider.apiKeysURL} target="_blank">
                                API key
                                <ExternalLink className="inline-block h-4 w-4 ml-1" />
                              </a>
                            ) : (
                              <>API key</>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <PasswordInput
                      placeholder={selectedProvider.id === 'routstr' ? 'Enter a Cashu Token' : 'Enter your API key'}
                      value={providerApiKey}
                      onChange={(e) => setProviderApiKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && providerApiKey.trim()) {
                          handleContinueFromProviderSelection();
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={handleContinueFromProviderSelection}
                    disabled={
                      !selectedProvider ||
                      isSettingUp ||
                      !!(selectedProvider?.apiKeysURL && !selectedProvider?.nostr && !providerApiKey.trim())
                    }
                    className="gap-2 rounded-full w-full max-w-md"
                  >
                    {isSettingUp ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'model-selection' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto min-h-0 my-4">
                  <div className="space-y-3 p-1">
                    {isLoadingModels ? (
                      <>
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Card key={i} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-16" />
                              </div>
                              <Skeleton className="h-4 w-full" />
                              <div className="flex gap-2">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-6 w-24" />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </>
                    ) : providerModels.length === 0 ? (
                      <Card className="p-6 text-center">
                        <div className="space-y-2">
                          <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            No models available. Please check your connection and try again.
                          </p>
                        </div>
                      </Card>
                    ) : (
                      providerModels.map((model) => {
                        const isSelected = selectedModel === model.fullId;
                        const isFree = model.pricing?.prompt.equals(0) && model.pricing?.completion.equals(0);
                        const isPremium = !!model.pricing && !isFree;

                        return (
                          <Card
                            key={model.fullId}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              isSelected ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => handleModelSelect(model.fullId)}
                          >
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <CardTitle className={`text-xl font-semibold ${isPremium ? 'bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent' : ''}`}>
                                    { model.name || model.description || model.id}
                                  </CardTitle>
                                  {model.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {model.description || model.id}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isFree && (
                                    <Badge variant="secondary" className="text-xs">
                                      Free
                                    </Badge>
                                  )}
                                  {isPremium && (
                                    <Badge className="text-xs bg-primary text-white border-0">
                                      Premium
                                    </Badge>
                                  )}
                                  {isSelected && (
                                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                            {(model.pricing || model.contextLength) && (
                              <CardContent className="pt-0">
                                <div className="flex items-end justify-end gap-4 text-xs text-muted-foreground">
                                  {model.pricing && (
                                    <div className="text-right">
                                      <div>Input: {formatPrice(model.pricing.prompt)}</div>
                                      <div>Output: {formatPrice(model.pricing.completion)}</div>
                                    </div>
                                  )}
                                  {model.contextLength && (
                                    <span>Context: {model.contextLength.toLocaleString()} tokens</span>
                                  )}
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 flex-shrink-0">
                  <Button
                    onClick={handleContinue}
                    disabled={!selectedModel}
                    className="gap-2"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'conclusion' && (
              <div className="text-center space-y-6 py-8">
                <div className="text-5xl mb-4">🎉</div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold">Now you're ready to build!</h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    Your AI assistant is configured and ready to help.
                    Just enter your prompt to start building amazing Nostr applications.
                  </p>
                </div>
                <Button onClick={handleFinish} size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Start Building
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      {showCreditsDialog && selectedModel && selectedProvider && (
        <CreditsDialog
          open={showCreditsDialog}
          onOpenChange={(open) => {
            if (!open) {
              handleCreditsDialogClose();
            }
          }}
          provider={{
            id: selectedProvider.id,
            baseURL: selectedProvider.baseURL,
            nostr: selectedProvider.nostr || undefined,
          }}
        />
      )}
    </>
  );
}