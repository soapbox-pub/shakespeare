import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAISettings } from '@/hooks/useAISettings';
import { useLoginActions } from '@/hooks/useLoginActions';
import { createAIClient } from '@/lib/ai-client';
import { AI_PROVIDER_PRESETS } from '@/lib/aiProviderPresets';
import { LoginArea } from '@/components/auth/LoginArea';
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

// No steps needed - everything on one screen!

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
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { settings, setProvider } = useAISettings();
  const { config } = useAppContext();
  const { toast } = useToast();
  const login = useLoginActions();
  const queryClient = useQueryClient();

  const [generatedNsec, setGeneratedNsec] = useState<string>('');
  const [agreedToProviderTerms, setAgreedToProviderTerms] = useState(false);
  const hasInitialized = useRef(false);

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
        title: '🎉 ' + t('giftCardRedeemed'),
        description: t('creditsAddedToAccount', { amount: formatCurrency(redemption.amount) }),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t('redemptionFailed'),
        description: error.message || t('failedToRedeemGiftCard'),
        variant: 'destructive',
      });
    },
  });

  // Reset state and initialize when dialog opens
  useEffect(() => {
    if (!open) {
      // Clear state when closing
      setGeneratedNsec('');
      setAgreedToProviderTerms(false);
      hasInitialized.current = false;
      return;
    }

    // Only initialize once when dialog opens
    if (!hasInitialized.current) {
      hasInitialized.current = true;

      // Auto-generate account if needed
      if (!user && !generatedNsec) {
        const secretKey = generateSecretKey();
        const nsec = nip19.nsecEncode(secretKey);
        setGeneratedNsec(nsec);
        login.nsec(nsec);
      }
    }
  }, [open, user, generatedNsec, login]);

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
    if (!user) return;

    // If provider not configured, add it first
    if (!matchingProvider && matchingPreset) {
      if (!agreedToProviderTerms) return;

      const providerConfig = {
        id: matchingPreset.id,
        baseURL: matchingPreset.baseURL,
        nostr: matchingPreset.nostr || undefined,
      };

      setProvider(providerConfig);
    }

    // Redeem the gift card
    redeemMutation.mutate(undefined, {
      onSuccess() {
        // Invalidate AI credits query for this provider and user
        const providerId = matchingProvider?.id || matchingPreset?.id;
        if (providerId) {
          queryClient.invalidateQueries({ queryKey: ['ai-credits', user.pubkey, providerId] });
        }
      }
    });
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
            <h2 className="text-2xl font-bold mb-2">{t('invalidGiftCard')}</h2>
            <p className="text-muted-foreground">
              {giftcardError instanceof Error ? giftcardError.message : t('giftCardNotFound')}
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-6">
              {t('close')}
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
            <h2 className="text-2xl font-bold mb-2">{t('alreadyRedeemed')}</h2>
            <p className="text-muted-foreground">
              {t('giftCardAlreadyRedeemed')}
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-6">
              {t('close')}
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
                {t('youveGotCredits', { amount: giftcard && formatCurrency(giftcard.amount) })}
              </h2>
              <p className="text-muted-foreground">
                {t('readyToAddCredits')}
              </p>
            </div>

            {/* Provider info */}
            {matchingPreset && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-muted-foreground">{t('provider')}:</span>
                  <span className="font-medium">{matchingPreset.name}</span>
                </div>
              </div>
            )}

            {/* Account selector - always show */}
            <div className="border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-3 text-left">
                {t('redeemingToAccount')}
              </p>
              <LoginArea className="w-full" />
            </div>

            {/* Provider ToS - only show if provider not configured */}
            {!matchingProvider && matchingPreset && (
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
                  {t('agreeToTermsOfService', { providerName: matchingPreset.name })}{' '}
                  {matchingPreset.tosURL ? (
                    <a
                      href={matchingPreset.tosURL}
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
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleRedeem}
                disabled={
                  !user ||
                  redeemMutation.isPending ||
                  (!matchingProvider && !agreedToProviderTerms)
                }
                size="lg"
                className="w-full text-lg h-14 font-semibold"
              >
                {redeemMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    {t('redeeming')}
                  </>
                ) : (
                  <>
                    <Gift className="h-5 w-5 mr-2" />
                    {t('redeemNow')}
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full"
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
