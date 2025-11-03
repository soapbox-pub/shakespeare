import { useState, useEffect, useRef } from 'react';
import { generateSecretKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import { Bot, Check, Sparkles, ArrowRight, ArrowLeft, ExternalLink, Search, Coins } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useAICredits } from '@/hooks/useAICredits';
import { CreditsDialog } from '@/components/CreditsDialog';
import { OnboardingCreditsBadge } from '@/components/OnboardingCreditsBadge';
import { ShakespeareLogo } from '@/components/ShakespeareLogo';
import { ModelPricing } from '@/components/ModelPricing';
import { AI_PROVIDER_PRESETS, type PresetProvider } from '@/lib/aiProviderPresets';
import { cn } from '@/lib/utils';
import { LoginArea } from '@/components/auth/LoginArea';

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OnboardingStep = 'welcome' | 'open-source' | 'provider-selection' | 'nostr-identity' | 'model-selection' | 'conclusion';

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<PresetProvider | null>(null);
  const [providerApiKey, setProviderApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToProviderTerms, setAgreedToProviderTerms] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [generatedNsec, setGeneratedNsec] = useState<string>('');

  // Ref for the scrollable content area
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  const { setProvider, addRecentlyUsedModel } = useAISettings();
  const { user } = useCurrentUser();
  const login = useLoginActions();
  const { models, isLoading: isLoadingModels } = useProviderModels();

  // Fetch credits for the selected provider (only if it's a Nostr provider and user is logged in)
  const creditsQuery = useAICredits(
    selectedProvider && selectedProvider.nostr && user
      ? {
        id: selectedProvider.id,
        baseURL: selectedProvider.baseURL,
        nostr: selectedProvider.nostr,
      }
      : { id: '', baseURL: '', nostr: undefined }
  );

  // Filter models to only show selected provider models
  const providerModels = selectedProvider
    ? models.filter(model => model.provider === selectedProvider.id)
    : [];

  // Filter models by search query
  const filteredModels = modelSearchQuery
    ? providerModels.filter(model => {
      const searchLower = modelSearchQuery.toLowerCase();
      const modelName = (model.name || model.id).toLowerCase();
      const modelDescription = (model.description || '').toLowerCase();
      return modelName.includes(searchLower) || modelDescription.includes(searchLower);
    })
    : providerModels;

  // Determine if we should show descriptions (only if 8 or fewer models)
  const showDescriptions = providerModels.length <= 8;

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
    // Reset provider terms agreement when switching providers
    setAgreedToProviderTerms(false);
  };

  const handleContinueFromProviderSelection = async () => {
    if (!selectedProvider) return;

    // Check if user agreed to provider terms
    if (!agreedToProviderTerms) return;

    // Check if provider requires API key and if it's provided
    const requiresApiKey = selectedProvider.apiKeysURL && !selectedProvider.nostr;
    if (requiresApiKey && !providerApiKey.trim()) return;

    setIsSettingUp(true);

    try {
      // If user is not logged in and provider uses Nostr auth, generate key and show identity step
      if (!user && selectedProvider.nostr) {
        const secretKey = generateSecretKey();
        const nsec = nip19.nsecEncode(secretKey);
        setGeneratedNsec(nsec);
        setStep('nostr-identity');
        setIsSettingUp(false);
        return;
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

  const handleContinueFromNostrIdentity = async () => {
    if (!selectedProvider) return;

    setIsSettingUp(true);

    try {
      // If no user is logged in yet, log in with generated key
      if (!user && generatedNsec) {
        login.nsec(generatedNsec);
      }

      // Add selected provider to their config
      const providerConfig = {
        id: selectedProvider.id,
        baseURL: selectedProvider.baseURL,
        nostr: selectedProvider.nostr || undefined,
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

    // Only show credits dialog if the provider uses Nostr AND the model is paid
    if (!isFreeModel && selectedProvider?.nostr) {
      setShowCreditsDialog(true);
    } else {
      // Free model or non-Nostr provider, go straight to conclusion
      setStep('conclusion');
    }
  };

  const handleCreditsDialogClose = () => {
    setShowCreditsDialog(false);
    setStep('conclusion');
  };

  const handleFinish = () => {
    onOpenChange(false);
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
      setAgreedToProviderTerms(false);
      setModelSearchQuery('');
      setGeneratedNsec('');
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
        <DialogContent className="max-w-2xl h-dvh-safe sm:h-auto sm:max-h-[90vh] flex flex-col">
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
              {step === 'nostr-identity' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('provider-selection')}
                  className="mr-2 p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 'model-selection' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Go back to nostr-identity if we have a generated key, otherwise provider-selection
                    setStep(generatedNsec ? 'nostr-identity' : 'provider-selection');
                  }}
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
                {step === 'model-selection' && t('chooseYourAIModel')}
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
                    {t('welcomeToShakespeareOnboarding')}
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    {t('aiPoweredDevelopmentAssistant')}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-lg mx-auto">
                    <div className="text-center space-y-2">
                      <div className="text-2xl">💡</div>
                      <p className="text-sm text-muted-foreground">{t('aiPoweredDevelopment')}</p>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl">⚡</div>
                      <p className="text-sm text-muted-foreground">{t('nostrIntegration')}</p>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-2xl">🚀</div>
                      <p className="text-sm text-muted-foreground">{t('instantPreview')}</p>
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
                        {t('settingUp')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {t('getStarted')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'open-source' && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">
                    {t('shakespeareOpenSource')}
                  </h2>
                </div>

                <div className="grid gap-1 max-w-md mx-auto">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">{t('yourDeviceConnects')}</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">{t('filesStoredOnDevice')}</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">{t('carefulBrowserData')}</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">{t('responsibleBackups')}</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <p className="text-sm">{t('qualityDependsOnInput')}</p>
                  </div>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  <p className="text-xs text-muted-foreground max-w-xl mx-auto">
                    {t('shakespeareNotCloudService')}
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
                      {t('iAgree')}
                    </label>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleContinueFromOpenSource}
                    disabled={!agreedToTerms}
                    className="gap-2 rounded-full w-full max-w-md"
                  >
                    {t('continueButton')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'provider-selection' && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">{t('chooseAIProvider')}</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {t('selectAIProviderDescription')}
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
                            <CardTitle className={cn('text-lg font-semibold', {
                              'bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent': isShakespeare,
                            })}>
                              {provider.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <OnboardingCreditsBadge provider={provider} />
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
                        {selectedProvider.id === 'routstr' ? t('enterCashuToken') : t('enterApiKey')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedProvider.id === 'routstr' ? (
                          t('requiresCashuToken', { providerName: selectedProvider.name })
                        ) : (
                          <>
                            {selectedProvider.name} {t('requiresAnApiKey')}{' '}
                            {selectedProvider.apiKeysURL ? (
                              <a className="text-foreground underline" href={selectedProvider.apiKeysURL} target="_blank">
                                {t('apiKey')}
                                <ExternalLink className="inline-block h-4 w-4 ml-1" />
                              </a>
                            ) : (
                              t('apiKey')
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <PasswordInput
                      placeholder={selectedProvider.id === 'routstr' ? t('enterCashuToken') : t('enterApiKey')}
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

                {/* Terms of Service Agreement */}
                {selectedProvider && (
                  <div className="space-y-3 max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox
                        id="agree-provider-terms"
                        checked={agreedToProviderTerms}
                        onCheckedChange={(checked) => setAgreedToProviderTerms(checked === true)}
                      />
                      <label
                        htmlFor="agree-provider-terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {t('agreeToTermsOfService', { providerName: selectedProvider.name })}{' '}
                        {selectedProvider.tosURL ? (
                          <a
                            href={selectedProvider.tosURL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t('termsOfService')}
                          </a>
                        ) : (
                          t('termsOfService')
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={handleContinueFromProviderSelection}
                    disabled={
                      !selectedProvider ||
                      isSettingUp ||
                      !agreedToProviderTerms ||
                      !!(selectedProvider?.apiKeysURL && !selectedProvider?.nostr && !providerApiKey.trim())
                    }
                    className="gap-2 rounded-full w-full max-w-md"
                  >
                    {isSettingUp ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        {t('settingUp')}
                      </>
                    ) : (
                      <>
                        {t('continueButton')}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 'nostr-identity' && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">Your Nostr Account</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    This is the account that will be used with {selectedProvider?.name}.
                  </p>
                </div>

                <div className="flex flex-col items-center space-y-4">
                  <LoginArea className="w-full max-w-xs" />

                  {user && creditsQuery.data && (
                    <div className="flex items-center gap-2 text-sm bg-muted/50 px-4 py-2 rounded-full">
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="font-semibold">
                        {creditsQuery.data.amount.toLocaleString()} credits available
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleContinueFromNostrIdentity}
                    disabled={isSettingUp}
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
                {/* Search filter - only show if more than 8 models */}
                {!isLoadingModels && providerModels.length > 8 && (
                  <div className="mb-4 flex-shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={t('searchModels')}
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                )}

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
                    ) : filteredModels.length === 0 ? (
                      <Card className="p-6 text-center">
                        <div className="space-y-2">
                          <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {modelSearchQuery ? t('noModelsMatchingSearch') : t('noModelsAvailable')}
                          </p>
                        </div>
                      </Card>
                    ) : (
                      filteredModels.map((model) => {
                        const isSelected = selectedModel === model.fullId;
                        const modelName = model.name || model.id;

                        return (
                          <Card
                            key={model.fullId}
                            className={`relative cursor-pointer transition-all hover:shadow-md ${
                              isSelected ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => handleModelSelect(model.fullId)}
                          >
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-sm font-semibold flex gap-1">
                                    <span>{modelName}</span>
                                    {model.pricing && <ModelPricing pricing={model.pricing} />}
                                  </CardTitle>
                                  {showDescriptions && model.description && (
                                    <p className="text-lg text-muted-foreground mt-1">
                                      {model.description.length > 500
                                        ? model.description.slice(0, 500) + '...'
                                        : model.description}
                                    </p>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="absolute top-5 right-5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                            </CardHeader>
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
                    {t('continueButton')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 'conclusion' && (
              <div className="text-center space-y-6 py-8">
                <div className="text-5xl mb-4">🎉</div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold">{t('nowYoureReady')}</h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    {t('aiAssistantConfigured')}
                  </p>
                </div>
                <Button onClick={handleFinish} size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t('startBuilding')}
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