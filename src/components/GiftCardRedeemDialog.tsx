import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Gift, Check, LogIn, Settings as SettingsIcon } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAISettings } from '@/hooks/useAISettings';
import { createAIClient } from '@/lib/ai-client';
import { AI_PROVIDER_PRESETS } from '@/lib/aiProviderPresets';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import SimpleLoginDialog from '@/components/auth/SimpleLoginDialog';
import SimpleSignupDialog from '@/components/auth/SimpleSignupDialog';
import { AddProviderDialog } from '@/components/AddProviderDialog';
import { useAppContext } from '@/hooks/useAppContext';

interface GiftCardRedeemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseURL: string;
  code: string;
}

interface Giftcard {
  object: 'giftcard';
  id: string;
  code: string;
  amount: number;
  redeemed: boolean;
  created_at?: number;
}

interface GiftcardRedemption {
  object: 'giftcard_redemption';
  amount: number;
}

type Step = 'preview' | 'login' | 'provider';

/**
 * Gift Card Redemption Dialog
 *
 * This component handles the complete gift card redemption flow, including:
 * - Fetching gift card details from the provider API
 * - Multi-step wizard for login and provider setup
 * - Account switching before redemption
 * - Automatic provider matching against presets
 *
 * Flow:
 * 1. Check if gift card is valid (unauthenticated API call)
 * 2. Determine required steps based on user state:
 *    - Not logged in? → Show login step
 *    - Provider not configured? → Show provider setup step
 *    - Ready to redeem? → Show preview with account switcher
 * 3. Redeem gift card and add credits to user's account
 * 4. Navigate to AI Settings to show new balance
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback when dialog open state changes
 * @param baseURL - Provider base URL (e.g., https://ai.shakespeare.diy/v1)
 * @param code - Gift card code to redeem (e.g., XXXX-XXXX-XXXX-XXXX)
 */
export function GiftCardRedeemDialog({ open, onOpenChange, baseURL, code }: GiftCardRedeemDialogProps) {
  const { user } = useCurrentUser();
  const { settings } = useAISettings();
  const { config } = useAppContext();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<Step>('preview');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [showAddProviderDialog, setShowAddProviderDialog] = useState(false);

  // Find matching provider by baseURL
  const matchingProvider = settings.providers.find(p => p.baseURL === baseURL);
  const matchingPreset = AI_PROVIDER_PRESETS.find(p => p.baseURL === baseURL);

  // Query gift card details without authentication
  const { data: giftcard, isLoading: isLoadingGiftcard, error: giftcardError } = useQuery({
    queryKey: ['giftcard-check', baseURL, code],
    queryFn: async (): Promise<Giftcard> => {
      const response = await fetch(`${baseURL}/credits/giftcards/check/${code}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch gift card details');
      }
      return response.json();
    },
    enabled: open && !!baseURL && !!code,
    retry: false,
  });

  // Mutation for redeeming gift card
  const redeemMutation = useMutation({
    mutationFn: async (): Promise<GiftcardRedemption> => {
      if (!matchingProvider) {
        throw new Error('Provider not configured');
      }
      const ai = createAIClient(matchingProvider, user, config.corsProxy);
      return await ai.post('/credits/giftcards/redeem', {
        body: { code },
      }) as GiftcardRedemption;
    },
    onSuccess: (redemption) => {
      toast({
        title: '🎉 Gift card redeemed!',
        description: `${formatCurrency(redemption.amount)} has been added to your account.`,
      });
      onOpenChange(false);
      // Navigate to AI settings to show the new credits
      navigate('/settings/ai');
    },
    onError: (error: Error) => {
      toast({
        title: 'Redemption failed',
        description: error.message || 'Failed to redeem gift card',
        variant: 'destructive',
      });
    },
  });

  // Determine current step based on conditions
  useEffect(() => {
    if (!open) return;

    // Check if user is logged in and provider is configured
    const hasUser = !!user;
    const hasProvider = !!matchingProvider;

    if (hasUser && hasProvider) {
      setCurrentStep('preview');
    } else if (!hasUser) {
      setCurrentStep('login');
    } else if (!hasProvider) {
      setCurrentStep('provider');
    }
  }, [open, user, matchingProvider]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleRedeem = () => {
    // Check prerequisites
    if (!user) {
      setCurrentStep('login');
      return;
    }

    if (!matchingProvider) {
      setCurrentStep('provider');
      return;
    }

    // All good, redeem the gift card
    redeemMutation.mutate();
  };

  const handleLoginSuccess = () => {
    setShowLoginDialog(false);
    setShowSignupDialog(false);

    // After login, check if provider is configured
    if (matchingProvider) {
      setCurrentStep('preview');
    } else {
      setCurrentStep('provider');
    }
  };

  const handleProviderAdded = () => {
    setShowAddProviderDialog(false);
    setCurrentStep('preview');
  };

  const handleNext = () => {
    if (currentStep === 'login') {
      // User needs to log in
      setShowSignupDialog(true);
    } else if (currentStep === 'provider') {
      // User needs to add provider
      setShowAddProviderDialog(true);
    }
  };

  const handleAddAccountClick = () => {
    setShowLoginDialog(true);
  };

  // Error state
  if (giftcardError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="mb-4">
              <Gift className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Invalid Gift Card</h2>
            <p className="text-muted-foreground">
              {giftcardError instanceof Error ? giftcardError.message : 'This gift card could not be found.'}
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-6">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Loading state
  if (isLoadingGiftcard) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-12 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Already redeemed
  if (giftcard?.redeemed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="mb-4">
              <Check className="h-16 w-16 mx-auto text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Already Redeemed</h2>
            <p className="text-muted-foreground">
              This gift card has already been redeemed.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-6">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8 space-y-6">
            {/* Animated gift icon */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 animate-pulse" />
              </div>
              <div className="relative flex items-center justify-center">
                <Gift className="h-16 w-16 text-primary animate-bounce" style={{ animationDuration: '2s' }} />
              </div>
            </div>

            {/* Title and amount */}
            <div>
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                You've got {giftcard && formatCurrency(giftcard.amount)}!
              </h2>
              <p className="text-muted-foreground">
                {currentStep === 'preview' && 'Ready to add these credits to your account?'}
                {currentStep === 'login' && 'First, let\'s get you logged in to redeem your credits'}
                {currentStep === 'provider' && `Add ${matchingPreset?.name || 'the provider'} to redeem your credits`}
              </p>
            </div>

            {/* Provider info */}
            {matchingPreset && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium">{matchingPreset.name}</span>
                </div>
              </div>
            )}

            {/* Account preview (only show on preview step) */}
            {currentStep === 'preview' && user && (
              <div className="border rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-3 text-left">Redeeming to account:</p>
                <AccountSwitcher onAddAccountClick={handleAddAccountClick} />
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              {currentStep === 'preview' ? (
                <Button
                  onClick={handleRedeem}
                  disabled={redeemMutation.isPending}
                  size="lg"
                  className="w-full text-lg h-14 font-semibold"
                >
                  {redeemMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <Gift className="h-5 w-5 mr-2" />
                      Redeem Now
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="w-full text-lg h-14 font-semibold"
                >
                  {currentStep === 'login' ? (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      Log In to Continue
                    </>
                  ) : (
                    <>
                      <SettingsIcon className="h-5 w-5 mr-2" />
                      Add Provider
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>

            {/* Progress indicator */}
            {currentStep !== 'preview' && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className={`h-2 w-2 rounded-full ${currentStep === 'login' ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`h-2 w-2 rounded-full ${currentStep === 'provider' ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`h-2 w-2 rounded-full bg-muted`} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Login/Signup Dialogs */}
      <SimpleLoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLogin={handleLoginSuccess}
        onSignup={() => {
          setShowLoginDialog(false);
          setShowSignupDialog(true);
        }}
      />

      <SimpleSignupDialog
        isOpen={showSignupDialog}
        onClose={() => setShowSignupDialog(false)}
        onComplete={handleLoginSuccess}
        onLogin={() => {
          setShowSignupDialog(false);
          setShowLoginDialog(true);
        }}
      />

      {/* Add Provider Dialog */}
      {matchingPreset && (
        <AddProviderDialog
          open={showAddProviderDialog}
          onOpenChange={(open) => {
            setShowAddProviderDialog(open);
            if (!open) {
              // Check if provider was added when dialog closes
              const wasAdded = settings.providers.some(p => p.baseURL === baseURL);
              if (wasAdded) {
                handleProviderAdded();
              }
            }
          }}
          provider={{
            id: matchingPreset.id,
            baseURL: matchingPreset.baseURL,
            nostr: matchingPreset.nostr,
            proxy: matchingPreset.proxy,
          }}
        />
      )}
    </>
  );
}
