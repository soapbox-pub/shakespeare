import { Decimal } from 'decimal.js';
import { useState, useEffect } from 'react';
import { generateSecretKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import { Bot, Check, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useProviderModels } from '@/hooks/useProviderModels';
import { CreditsDialog } from '@/components/CreditsDialog';
interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OnboardingStep = 'welcome' | 'model-selection' | 'conclusion';

const SHAKESPEARE_PROVIDER = {
  id: "shakespeare",
  baseURL: "https://ai.shakespeare.diy/v1",
  nostr: true,
};

export function OnboardingDialog({ open, onOpenChange }: OnboardingDialogProps) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  const { setProvider, addRecentlyUsedModel } = useAISettings();
  const { user } = useCurrentUser();
  const login = useLoginActions();
  const { models, isLoading: isLoadingModels } = useProviderModels();

  // Filter models to only show Shakespeare provider models
  const shakespeareModels = models.filter(model => model.provider === 'shakespeare');

  const handleGetStarted = async () => {
    setIsSettingUp(true);

    try {
      // If user is not logged in, generate and login with secret key
      if (!user) {
        const secretKey = generateSecretKey();
        const nsec = nip19.nsecEncode(secretKey);
        login.nsec(nsec);
      }

      // Add Shakespeare provider to their config
      setProvider(SHAKESPEARE_PROVIDER);

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
    const model = shakespeareModels.find(m => m.fullId === selectedModel);
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
      setSelectedModel('');
      setIsSettingUp(false);
      setShowCreditsDialog(false);
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === 'model-selection' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('welcome')}
                  className="mr-2 p-1 h-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xl">
                {step === 'welcome' && 'Welcome to Shakespeare!'}
                {step === 'model-selection' && 'Choose Your AI Model'}
                {step === 'conclusion' && "You're All Set!"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {step === 'welcome' && (
              <div className="text-center space-y-6 py-4">
                <div className="text-6xl mb-4">🎭</div>
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

            {step === 'model-selection' && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">
                    Choose an AI model to power your development experience.
                    Different models offer various capabilities and pricing.
                  </p>
                </div>

                <ScrollArea className="h-96">
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
                    ) : shakespeareModels.length === 0 ? (
                      <Card className="p-6 text-center">
                        <div className="space-y-2">
                          <Bot className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-muted-foreground">
                            No models available. Please check your connection and try again.
                          </p>
                        </div>
                      </Card>
                    ) : (
                      shakespeareModels.map((model) => {
                        const isSelected = selectedModel === model.fullId;
                        const isFree = model.pricing?.prompt.equals(0) && model.pricing?.completion.equals(0);

                        return (
                          <Card
                            key={model.fullId}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              isSelected ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => handleModelSelect(model.fullId)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-base font-semibold">
                                    {model.description || model.name || model.id}
                                  </CardTitle>
                                  {model.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {model.name || model.id}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isFree && (
                                    <Badge variant="secondary" className="text-xs">
                                      Free
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
                            <CardContent className="pt-0">
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {model.pricing && (
                                  <>
                                    <span>Input: {formatPrice(model.pricing.prompt)}</span>
                                    <span>Output: {formatPrice(model.pricing.completion)}</span>
                                  </>
                                )}
                                {model.contextLength && (
                                  <span>Context: {model.contextLength.toLocaleString()} tokens</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                <div className="flex justify-end gap-2 pt-4 border-t">
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
                <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground italic">
                    "Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies..."
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
      {showCreditsDialog && selectedModel && (
        <CreditsDialog
          open={showCreditsDialog}
          onOpenChange={(open) => {
            if (!open) {
              handleCreditsDialogClose();
            }
          }}
          provider={SHAKESPEARE_PROVIDER}
        />
      )}
    </>
  );
}