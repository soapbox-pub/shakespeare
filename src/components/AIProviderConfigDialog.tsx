import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Trash2, Bot, CreditCard, Zap, ExternalLink, RefreshCw, Check, X, Clock, AlertCircle, Copy, RotateCcw, ArrowLeft, Gift, Plus, History, DollarSign, Printer, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { useToast } from '@/hooks/useToast';
import { useAICredits } from '@/hooks/useAICredits';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';

interface AIProviderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
  onUpdate: (provider: AIProvider) => void;
  onRemove: () => void;
}

interface Payment {
  object: 'payment';
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  amount: number;
  fee: number;
  total: number;
  method: 'stripe' | 'lightning';
  description: string;
  url: string;
  created_at: number;
  completed_at?: number;
  expires_at: number;
}

interface PaymentsResponse {
  object: 'list';
  data: Payment[];
  has_more: boolean;
  url: string;
}

interface AddCreditsRequest {
  amount: number;
  method: 'stripe' | 'lightning';
  redirect_url?: string;
}

interface Giftcard {
  object: 'giftcard';
  id: string;
  code: string;
  amount: number;
  redeemed: boolean;
  created_at?: number;
}

interface GiftcardsResponse {
  object: 'list';
  data: Giftcard[];
  has_more: boolean;
}

interface CreateGiftcardRequest {
  amount: number;
  quantity: number;
}

interface RedeemGiftcardRequest {
  code: string;
}

interface GiftcardRedemption {
  object: 'giftcard_redemption';
  amount: number;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

interface LightningPaymentProps {
  invoice: string;
  amount: number;
  paymentId: string;
  provider: AIProvider;
  onClose: () => void;
  onPaymentCompleted: () => void;
}

function LightningPayment({ invoice, amount, paymentId, provider, onClose, onPaymentCompleted }: LightningPaymentProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const queryClient = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isWebLNAvailable, setIsWebLNAvailable] = useState(false);
  const [isPayingWithWebLN, setIsPayingWithWebLN] = useState(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const { toast } = useToast();

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  useEffect(() => {
    // Generate QR code
    QRCode.toDataURL(invoice, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);

    // Check for WebLN availability
    setIsWebLNAvailable(typeof window !== 'undefined' && 'webln' in window);
  }, [invoice]);

  // Poll payment status
  useEffect(() => {
    // Don't poll if payment already completed
    if (paymentCompleted) return;

    let intervalId: NodeJS.Timeout | null = null;

    const pollPaymentStatus = async () => {
      // Double-check in case state updated during async operation
      if (paymentCompleted) return;

      try {
        const ai = createAIClient(provider, user, config.corsProxy);
        const payment = await ai.get(`/credits/payments/${paymentId}`) as Payment;

        if (payment.status === 'completed') {
          // Mark as completed to prevent further polling
          setPaymentCompleted(true);

          // Clear the interval immediately
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          // Update credits balance
          queryClient.invalidateQueries({
            queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
          });

          // Update payments list
          queryClient.invalidateQueries({
            queryKey: ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
          });

          // Show toast
          toast({
            title: t('paymentCompleted'),
            description: t('creditsAddedToAccount', { amount: formatCurrency(payment.amount) }),
          });

          // Close dialog immediately
          onPaymentCompleted();
        } else if (payment.status === 'failed') {
          // Mark as completed to prevent further polling
          setPaymentCompleted(true);

          // Clear the interval immediately
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          toast({
            title: t('paymentFailed'),
            description: t('paymentFailed'),
            variant: 'destructive',
          });
        } else if (payment.status === 'expired') {
          // Mark as completed to prevent further polling
          setPaymentCompleted(true);

          // Clear the interval immediately
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }

          toast({
            title: t('paymentExpired'),
            description: t('paymentExpiredMessage'),
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to poll payment status:', error);
      }
    };

    // Poll immediately on mount
    pollPaymentStatus();

    // Then poll every 3 seconds
    intervalId = setInterval(pollPaymentStatus, 3000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [paymentId, provider, user, config.corsProxy, queryClient, toast, t, onPaymentCompleted, formatCurrency, paymentCompleted]);

  const handleWebLNPay = async () => {
    if (!window.webln) return;

    try {
      setIsPayingWithWebLN(true);
      await window.webln.enable();
      await window.webln.sendPayment(invoice);

      toast({
        title: t('paymentSent'),
        description: t('lightningPaymentSent'),
      });

      onClose();
    } catch (error) {
      console.error('WebLN payment failed:', error);
      toast({
        title: t('paymentFailed'),
        description: error instanceof Error ? error.message : t('failedToSendLightning'),
        variant: 'destructive',
      });
    } finally {
      setIsPayingWithWebLN(false);
    }
  };

  const handleCopyInvoice = () => {
    navigator.clipboard.writeText(invoice);
    setShowCopiedTooltip(true);
    setTimeout(() => setShowCopiedTooltip(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">{t('lightningPayment')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('payWithLightning', { amount: formatCurrency(amount) })}
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        {qrDataUrl ? (
          <div className="p-4 bg-white rounded-lg border">
            <img src={qrDataUrl} alt="Lightning Invoice QR Code" className="w-48 h-48" />
          </div>
        ) : (
          <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      {/* Payment Buttons */}
      <div className="space-y-2">
        {isWebLNAvailable && (
          <Button
            onClick={handleWebLNPay}
            disabled={isPayingWithWebLN}
            className="w-full"
            size="lg"
          >
            {isPayingWithWebLN && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            <Zap className="h-4 w-4 mr-2" />
            {t('payWithWebLN')}
          </Button>
        )}

        <div className="relative">
          <Button
            variant="outline"
            onClick={handleCopyInvoice}
            className="w-full"
            size="lg"
          >
            <Copy className="h-4 w-4 mr-2" />
            {t('copyInvoice')}
          </Button>
          {showCopiedTooltip && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-10 animate-in fade-in-0 duration-200">
              {t('copied')}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIProviderConfigDialog({
  open,
  onOpenChange,
  provider,
  onUpdate,
  onRemove,
}: AIProviderConfigDialogProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localProvider, setLocalProvider] = useState(provider);

  // Check if provider supports credits
  const { data: credits, error: creditsError, isLoading: isLoadingCredits } = useAICredits(provider);
  const supportsCredits = !creditsError && credits !== undefined;

  // Credits state
  const [amount, setAmount] = useState<number>(10);
  const [debouncedAmount, setDebouncedAmount] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'lightning'>('stripe');
  const [lightningInvoice, setLightningInvoice] = useState<string | null>(null);
  const [lightningPaymentId, setLightningPaymentId] = useState<string | null>(null);
  const [lightningTotal, setLightningTotal] = useState<number>(10);
  const [refreshingPayments, setRefreshingPayments] = useState<Set<string>>(new Set());
  const amountDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [giftcardAmount, setGiftcardAmount] = useState<number>(10);
  const [giftcardQuantity, setGiftcardQuantity] = useState<number>(1);
  const [redeemCode, setRedeemCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPrintingQRCodes, setIsPrintingQRCodes] = useState(false);
  // Default to 'credits' tab
  const [activeTab, setActiveTab] = useState<string>('credits');

  // Reset local state when provider changes or dialog opens
  useEffect(() => {
    if (open) {
      setLocalProvider(provider);
    }
  }, [provider, open]);

  // Set active tab based on credits support
  useEffect(() => {
    if (open && !isLoadingCredits) {
      // Default to 'credits' tab if credits are supported, otherwise 'edit'
      if (supportsCredits) {
        setActiveTab('credits');
      } else {
        setActiveTab('edit');
      }
    }
  }, [open, supportsCredits, isLoadingCredits]);

  // Debounce amount changes to avoid excessive API calls
  useEffect(() => {
    if (amountDebounceTimer.current) {
      clearTimeout(amountDebounceTimer.current);
    }

    amountDebounceTimer.current = setTimeout(() => {
      setDebouncedAmount(amount);
    }, 500); // Wait 500ms after user stops typing

    return () => {
      if (amountDebounceTimer.current) {
        clearTimeout(amountDebounceTimer.current);
      }
    };
  }, [amount]);

  // Query for payment preview (to get fee information)
  const { data: paymentPreview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['ai-payment-preview', provider.nostr ? user?.pubkey ?? '' : '', provider.id, debouncedAmount, paymentMethod],
    queryFn: async (): Promise<Payment> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      const request: AddCreditsRequest = {
        amount: debouncedAmount,
        method: paymentMethod,
      };

      if (paymentMethod === 'stripe') {
        request.redirect_url = window.location.origin + '/settings/ai';
      }

      return await ai.post('/credits/add', {
        body: request,
      }) as Payment;
    },
    enabled: open && supportsCredits && debouncedAmount > 0,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
  });

  // Query for payment history
  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
    queryFn: async (): Promise<Payment[]> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      const data = await ai.get('/credits/payments?status=completed&limit=50') as PaymentsResponse;
      return data.data;
    },
    enabled: open && supportsCredits,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Query for gift cards
  const { data: giftcards, isLoading: isLoadingGiftcards } = useQuery({
    queryKey: ['ai-giftcards', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
    queryFn: async (): Promise<Giftcard[]> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      const data = await ai.get('/credits/giftcards?limit=50') as GiftcardsResponse;
      return data.data;
    },
    enabled: open && supportsCredits,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Mutation for adding credits
  const addCreditsMutation = useMutation({
    mutationFn: async (request: AddCreditsRequest): Promise<Payment> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      return await ai.post('/credits/add', {
        body: request,
      }) as Payment;
    },
    onSuccess: (payment) => {
      if (payment.method === 'stripe') {
        window.open(payment.url, '_blank');
        toast({
          title: t('paymentInitiated'),
          description: t('stripeCheckoutOpened'),
        });
      } else if (payment.method === 'lightning') {
        setLightningInvoice(payment.url);
        setLightningPaymentId(payment.id);
        setLightningTotal(payment.total);
      }

      queryClient.invalidateQueries({
        queryKey: ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || t('paymentFailed');
      toast({
        title: t('paymentFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Mutation for checking payment status
  const checkPaymentMutation = useMutation({
    mutationFn: async (paymentId: string): Promise<Payment> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      return await ai.get(`/credits/payments/${paymentId}`) as Payment;
    },
    onMutate: async (paymentId: string) => {
      setRefreshingPayments(prev => new Set(prev).add(paymentId));
    },
    onSuccess: (updatedPayment) => {
      setRefreshingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(updatedPayment.id);
        return newSet;
      });

      queryClient.setQueryData<Payment[]>(
        ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
        (oldPayments) => {
          if (!oldPayments) return oldPayments;
          return oldPayments.map(payment =>
            payment.id === updatedPayment.id ? updatedPayment : payment
          );
        }
      );

      if (updatedPayment.status === 'completed') {
        queryClient.invalidateQueries({
          queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
        });
        toast({
          title: t('paymentCompleted'),
          description: t('creditsAddedToAccount', { amount: formatCurrency(updatedPayment.amount) }),
        });
      } else if (updatedPayment.status === 'failed') {
        toast({
          title: t('paymentFailed'),
          description: t('paymentFailed'),
          variant: 'destructive',
        });
      } else if (updatedPayment.status === 'expired') {
        toast({
          title: t('paymentExpired'),
          description: t('paymentExpiredMessage'),
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error, paymentId: string) => {
      setRefreshingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });

      const errorMessage = error?.message || t('failedToCheckPaymentStatus');
      toast({
        title: t('refreshFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Mutation for creating gift cards
  const createGiftcardMutation = useMutation({
    mutationFn: async (request: CreateGiftcardRequest): Promise<Giftcard[]> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      const response = await ai.post('/credits/giftcards', {
        body: request,
      }) as GiftcardsResponse;
      return response.data;
    },
    onSuccess: (giftcards) => {
      toast({
        title: t('giftCardCreated'),
        description: t('successfullyCreatedGiftCards', { count: giftcards.length }),
      });

      queryClient.invalidateQueries({
        queryKey: ['ai-giftcards', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      setGiftcardAmount(10);
      setGiftcardQuantity(1);
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || t('failedToCreateGiftCards');
      toast({
        title: t('creationFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Mutation for redeeming gift cards
  const redeemGiftcardMutation = useMutation({
    mutationFn: async (request: RedeemGiftcardRequest): Promise<GiftcardRedemption> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      return await ai.post('/credits/giftcards/redeem', {
        body: request,
      }) as GiftcardRedemption;
    },
    onSuccess: (redemption) => {
      toast({
        title: t('giftCardRedeemed'),
        description: t('creditsAddedToAccount', { amount: formatCurrency(redemption.amount) }),
      });

      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      setRedeemCode('');
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || t('failedToRedeemGiftCard');
      toast({
        title: t('redemptionFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    onUpdate(localProvider);
    onOpenChange(false);
  };

  const handleDelete = () => {
    onRemove();
    onOpenChange(false);
  };

  const handleAddCredits = () => {
    if (amount <= 0) {
      toast({
        title: t('invalidAmount'),
        description: t('enterValidAmount'),
        variant: 'destructive',
      });
      return;
    }

    if (paymentPreview) {
      if (paymentPreview.method === 'stripe') {
        window.open(paymentPreview.url, '_blank');
        toast({
          title: t('paymentInitiated'),
          description: t('stripeCheckoutOpened'),
        });
      } else if (paymentPreview.method === 'lightning') {
        setLightningInvoice(paymentPreview.url);
        setLightningPaymentId(paymentPreview.id);
        setLightningTotal(paymentPreview.total);
      }

      queryClient.invalidateQueries({
        queryKey: ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      queryClient.invalidateQueries({
        queryKey: ['ai-payment-preview', provider.nostr ? user?.pubkey ?? '' : '', provider.id, amount, paymentMethod],
      });
    } else {
      const request: AddCreditsRequest = {
        amount,
        method: paymentMethod,
      };

      if (paymentMethod === 'stripe') {
        request.redirect_url = window.location.origin + '/settings/ai';
      }

      addCreditsMutation.mutate(request);
    }
  };

  const handleCreateGiftcard = () => {
    if (giftcardAmount <= 0) {
      toast({
        title: t('invalidAmount'),
        description: t('enterValidAmount'),
        variant: 'destructive',
      });
      return;
    }

    if (giftcardQuantity <= 0 || giftcardQuantity > 100) {
      toast({
        title: t('invalidQuantity'),
        description: t('quantityBetween'),
        variant: 'destructive',
      });
      return;
    }

    createGiftcardMutation.mutate({
      amount: giftcardAmount,
      quantity: giftcardQuantity,
    });
  };

  const handleRedeemGiftcard = () => {
    const trimmedCode = redeemCode.trim();
    if (!trimmedCode) {
      toast({
        title: t('invalidCode'),
        description: t('enterGiftCardCodePrompt'),
        variant: 'destructive',
      });
      return;
    }

    redeemGiftcardMutation.mutate({ code: trimmedCode });
  };

  const handleCopyCode = (code: string) => {
    const url = new URL('/giftcard', window.location.origin);
    url.hash = new URLSearchParams({
      baseURL: provider.baseURL,
      code: code,
    }).toString();

    navigator.clipboard.writeText(url.toString());
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePrintGiftcards = async () => {
    if (!giftcards || giftcards.length === 0) return;

    const activeGiftcards = giftcards.filter(gc => !gc.redeemed);
    if (activeGiftcards.length === 0) {
      toast({
        title: t('noActiveGiftCards'),
        description: t('noActiveGiftCardsToPrint'),
        variant: 'destructive',
      });
      return;
    }

    setIsPrintingQRCodes(true);

    try {
      const qrCodePromises = activeGiftcards.map(async (giftcard) => {
        const url = `${window.location.origin}/giftcard#baseURL=${encodeURIComponent(provider.baseURL)}&code=${encodeURIComponent(giftcard.code)}`;
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        return {
          ...giftcard,
          qrDataUrl,
        };
      });

      const giftcardsWithQR = await Promise.all(qrCodePromises);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error(t('failedToOpenPrintWindow'));
      }

      const printHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Shakespeare AI Gift Cards</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                padding: 20px;
                background: white;
              }

              .grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                max-width: 8.5in;
                margin: 0 auto;
              }

              .card {
                border: 2px solid #000;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                page-break-inside: avoid;
                background: white;
              }

              .card-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 15px;
                color: #000;
              }

              .qr-code {
                width: 200px;
                height: 200px;
                margin: 0 auto 15px;
                display: block;
              }

              .amount {
                font-size: 24px;
                font-weight: 700;
                color: #000;
                margin-bottom: 10px;
              }

              .code {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                background: #f5f5f5;
                padding: 8px 12px;
                border-radius: 4px;
                word-break: break-all;
                color: #000;
                border: 1px solid #ddd;
              }

              .footer {
                margin-top: 10px;
                font-size: 12px;
                color: #666;
              }

              @media print {
                body {
                  padding: 0;
                }

                .grid {
                  gap: 15px;
                }

                .card {
                  page-break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${giftcardsWithQR.map(gc => `
                <div class="card">
                  <div class="card-title">Shakespeare AI Gift Card</div>
                  <img src="${gc.qrDataUrl}" alt="QR Code" class="qr-code" />
                  <div class="amount">${formatCurrency(gc.amount)}</div>
                  <div class="code">${gc.code}</div>
                  <div class="footer">Scan to redeem</div>
                </div>
              `).join('')}
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(printHTML);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    } catch (error) {
      console.error('Failed to generate QR codes:', error);
      toast({
        title: t('printFailed'),
        description: error instanceof Error ? error.message : t('failedToGenerateQRCodes'),
        variant: 'destructive',
      });
    } finally {
      setIsPrintingQRCodes(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!giftcards || giftcards.length === 0) return;

    const activeGiftcards = giftcards.filter(gc => !gc.redeemed);
    if (activeGiftcards.length === 0) {
      toast({
        title: t('noActiveGiftCards'),
        description: t('noActiveGiftCardsToDownload'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const headers = ['Code', 'Amount', 'Status', 'Created Date', 'Redemption URL'];

      const rows = activeGiftcards.map(gc => {
        const url = `${window.location.origin}/giftcard#baseURL=${encodeURIComponent(provider.baseURL)}&code=${encodeURIComponent(gc.code)}`;
        const createdDate = gc.created_at
          ? new Date(gc.created_at * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
          : 'N/A';

        return [
          gc.code,
          Number(gc.amount).toFixed(2),
          gc.redeemed ? 'Redeemed' : 'Active',
          createdDate,
          url
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `shakespeare-giftcards-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast({
        title: t('csvDownloaded'),
        description: t('downloadedGiftCards', { count: activeGiftcards.length }),
      });
    } catch (error) {
      console.error('Failed to generate CSV:', error);
      toast({
        title: t('downloadFailed'),
        description: error instanceof Error ? error.message : t('failedToGenerateCSV'),
        variant: 'destructive',
      });
    }
  };

  // Shared utility functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } else if (diffDays === 1) {
      return t('yesterday');
    } else if (diffDays < 7) {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
      }).format(date);
    } else {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(date);
    }
  };

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  // Render functions for shared content
  const renderEditContent = () => (
    <div className="space-y-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="provider-name">
          {t('name')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="provider-name"
          placeholder="Provider name"
          value={localProvider.name || ''}
          onChange={(e) => setLocalProvider({ ...localProvider, name: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="provider-baseURL">
          {t('baseUrl')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="provider-baseURL"
          placeholder="https://api.example.com/v1"
          value={localProvider.baseURL || ''}
          onChange={(e) => setLocalProvider({ ...localProvider, baseURL: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="provider-auth">{t('authentication')}</Label>
        <Select
          value={localProvider.nostr ? 'nostr' : 'api-key'}
          onValueChange={(value: 'api-key' | 'nostr') => setLocalProvider({
            ...localProvider,
            nostr: value === 'nostr' || undefined,
            apiKey: value === 'nostr' ? undefined : localProvider.apiKey
          })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="api-key">{t('apiKey')}</SelectItem>
            <SelectItem value="nostr">Nostr</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!localProvider.nostr && (
        <div className="grid gap-2">
          <Label htmlFor="provider-apiKey">{t('apiKey')}</Label>
          <PasswordInput
            id="provider-apiKey"
            placeholder={t('enterApiKey')}
            value={localProvider.apiKey || ''}
            onChange={(e) => setLocalProvider({ ...localProvider, apiKey: e.target.value })}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="provider-proxy"
          checked={localProvider.proxy || false}
          onCheckedChange={(checked) => setLocalProvider({
            ...localProvider,
            proxy: checked === true || undefined
          })}
        />
        <Label htmlFor="provider-proxy" className="cursor-pointer">
          {t('useCorsProxy')}
        </Label>
      </div>
    </div>
  );

  const renderCreditsContent = () => {
    return (
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Credits Balance Display */}
        {credits && (
          <div className="text-center py-6 pb-7">
            <div className="text-sm text-muted-foreground mb-2">{t('availableCredits')}</div>
            <div className="text-3xl font-bold">{formatCurrency(credits.amount)}</div>
          </div>
        )}

        <div className="overflow-x-hidden">
          <Accordion type="multiple" defaultValue={[]} className="w-full space-y-2">
            {/* Buy Credits Accordion */}
            <AccordionItem value="add">
              <AccordionTrigger className="hover:no-underline px-4 py-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  {t('buyCredits')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3 pt-2 pb-3">
                  <div className="space-y-3">
                    <Label htmlFor="amount" className="text-sm font-medium">{t('amountUSD')}</Label>
                    <div className="space-y-3">
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder={t('enterAmount')}
                        className="text-center text-lg font-medium"
                      />
                      <div className="grid grid-cols-5 gap-2">
                        {PRESET_AMOUNTS.map((preset) => (
                          <Button
                            key={preset}
                            variant={amount === preset ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAmount(preset)}
                            className="text-xs"
                          >
                        ${preset}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('paymentMethod')}</Label>
                    <Tabs value={paymentMethod} onValueChange={(value: 'stripe' | 'lightning') => setPaymentMethod(value)} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="stripe" className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          {t('creditCard')}
                        </TabsTrigger>
                        <TabsTrigger value="lightning" className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          {t('lightning')}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {paymentPreview && paymentPreview.fee > 0 && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('credits')}</span>
                        <span>{formatCurrency(paymentPreview.amount)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('processingFee')}</span>
                        <span>{formatCurrency(paymentPreview.fee)}</span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t">
                        <span>{t('total')}</span>
                        <span>{formatCurrency(paymentPreview.total)}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleAddCredits}
                    disabled={amount <= 0 || addCreditsMutation.isPending || isLoadingPreview}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                  >
                    {(addCreditsMutation.isPending || isLoadingPreview) && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    {paymentMethod === 'stripe' ? t('payWithCard') : t('generateInvoice')}
                    {paymentPreview && paymentPreview.fee > 0
                      ? ` - ${formatCurrency(paymentPreview.total)}`
                      : amount > 0
                        ? ` - ${formatCurrency(amount)}`
                        : ''
                    }
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Transaction History Accordion */}
            <AccordionItem value="history">
              <AccordionTrigger className="hover:no-underline px-4 py-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  {t('recentTransactions')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="pt-2 pb-3">
                  {isLoadingPayments ? (
                    <div className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </div>
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ) : !payments || payments.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{t('noTransactionsYet')}</p>
                      <p className="text-xs">{t('paymentHistoryAppears')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="p-3 border rounded-lg space-y-2 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {getStatusIcon(payment.status)}
                              <span className="text-sm font-medium truncate">
                                {payment.method === 'stripe' ? t('creditCard') : t('lightning')}
                              </span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                              {payment.fee > 0 && (
                                <p className="text-xs text-muted-foreground">
                            +{formatCurrency(payment.fee)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatDate(payment.created_at)}</span>
                            {payment.status === 'pending' && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => checkPaymentMutation.mutate(payment.id)}
                                  disabled={refreshingPayments.has(payment.id)}
                                  className="h-6 px-2 text-xs"
                                  title="Refresh payment status"
                                >
                                  <RotateCcw className={`h-3 w-3 ${refreshingPayments.has(payment.id) ? 'animate-spin' : ''}`} />
                                </Button>
                                {payment.url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (payment.method === 'lightning') {
                                        setLightningInvoice(payment.url);
                                        setLightningPaymentId(payment.id);
                                        setLightningTotal(payment.total);
                                      } else {
                                        window.open(payment.url, '_blank');
                                      }
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    {t('pay')}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Redeem Gift Card Accordion */}
            <AccordionItem value="redeem">
              <AccordionTrigger className="hover:no-underline px-4 py-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  {t('redeemGiftCard')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3 pt-2 pb-3">
                  <div className="flex gap-2">
                    <Input
                      id="redeem-code"
                      type="text"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value)}
                      placeholder={t('enterGiftCardCode')}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleRedeemGiftcard}
                      disabled={!redeemCode.trim() || redeemGiftcardMutation.isPending}
                      size="lg"
                    >
                      {redeemGiftcardMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                      {t('redeem')}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Create Gift Card Accordion */}
            <AccordionItem value="create">
              <AccordionTrigger className="hover:no-underline px-4 py-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  {t('createGiftCard')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3 pt-2 pb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="giftcard-amount" className="text-xs text-muted-foreground">{t('amountUSD')}</Label>
                      <Input
                        id="giftcard-amount"
                        type="number"
                        step="0.01"
                        value={giftcardAmount}
                        onChange={(e) => setGiftcardAmount(Number(e.target.value))}
                        placeholder={t('enterAmount')}
                        className="text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giftcard-quantity" className="text-xs text-muted-foreground">{t('quantity')}</Label>
                      <Input
                        id="giftcard-quantity"
                        type="number"
                        min="1"
                        max="100"
                        value={giftcardQuantity}
                        onChange={(e) => setGiftcardQuantity(Number(e.target.value))}
                        placeholder={t('qty')}
                        className="text-center"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                      <Button
                        key={preset}
                        variant={giftcardAmount === preset ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGiftcardAmount(preset)}
                        className="text-xs"
                      >
                    ${preset}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={handleCreateGiftcard}
                    disabled={giftcardAmount <= 0 || giftcardQuantity <= 0 || createGiftcardMutation.isPending}
                    className="w-full h-12 text-base font-medium"
                    size="lg"
                  >
                    {createGiftcardMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    {t('createGiftCards', { count: giftcardQuantity })}
                    {giftcardAmount > 0 && giftcardQuantity > 0 && ` - ${formatCurrency(giftcardAmount * giftcardQuantity)}`}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Your Gift Cards Accordion */}
            <AccordionItem value="list">
              <AccordionTrigger className="hover:no-underline px-4 py-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {t('yourGiftCards')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="pt-2 pb-3 space-y-3">
                  {giftcards && giftcards.filter(gc => !gc.redeemed).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handlePrintGiftcards}
                        disabled={isPrintingQRCodes}
                        variant="outline"
                        size="sm"
                      >
                        {isPrintingQRCodes ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4 mr-2" />
                        )}
                        {t('printQRCodes')}
                      </Button>
                      <Button
                        onClick={handleDownloadCSV}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t('downloadCSV')}
                      </Button>
                    </div>
                  )}
                  {isLoadingGiftcards ? (
                    <div className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </div>
                      <Skeleton className="h-3 w-48" />
                    </div>
                  ) : !giftcards || giftcards.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Gift className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{t('noGiftCardsYet')}</p>
                      <p className="text-xs">{t('createGiftCardsToShare')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {giftcards.map((giftcard) => (
                        <div
                          key={giftcard.id}
                          className="p-3 border rounded-lg space-y-2 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Gift className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {t('giftCard')}
                              </span>
                              <Badge variant={giftcard.redeemed ? "secondary" : "default"} className="text-xs flex-shrink-0">
                                {giftcard.redeemed ? t('redeemed') : t('active')}
                              </Badge>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-medium">{formatCurrency(giftcard.amount)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {giftcard.code}
                            </code>
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCode(giftcard.code)}
                                className="h-6 px-2 text-xs"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                {t('copy')}
                              </Button>
                              {copiedCode === giftcard.code && (
                                <div className="absolute -top-8 right-0 bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-10 animate-in fade-in-0 duration-200 whitespace-nowrap">
                                  {t('copied')}
                                </div>
                              )}
                            </div>
                          </div>

                          {giftcard.created_at && (
                            <div className="text-xs text-muted-foreground">
                              {t('created')} {formatDate(giftcard.created_at)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={supportsCredits
          ? "max-w-lg w-full max-h-[75vh] overflow-hidden flex flex-col sm:max-w-lg sm:max-h-[75vh] max-sm:w-full max-sm:h-dvh-safe max-sm:max-w-none max-sm:max-h-none max-sm:m-0 max-sm:rounded-none"
          : "max-w-md"
        }
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            {localProvider.baseURL ? (
              <ExternalFavicon
                url={localProvider.baseURL}
                size={20}
                fallback={<Bot size={20} />}
              />
            ) : (
              <Bot size={20} />
            )}
            <DialogTitle>{localProvider.name}</DialogTitle>
          </div>
          {!supportsCredits && (
            <DialogDescription>
              Configure your AI provider settings
            </DialogDescription>
          )}
        </DialogHeader>

        {supportsCredits ? (
          <>
            {lightningInvoice ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 pb-4 flex-shrink-0">
                  <button
                    onClick={() => setLightningInvoice(null)}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    {t('back')}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-1 -mx-1">
                  <LightningPayment
                    invoice={lightningInvoice}
                    amount={lightningTotal}
                    paymentId={lightningPaymentId!}
                    provider={provider}
                    onClose={() => {
                      setLightningInvoice(null);
                      setLightningPaymentId(null);
                    }}
                    onPaymentCompleted={() => {
                      setLightningInvoice(null);
                      setLightningPaymentId(null);
                    }}
                  />
                </div>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                  <TabsTrigger value="credits">{t('credits')}</TabsTrigger>
                  <TabsTrigger value="edit">{t('edit')}</TabsTrigger>
                </TabsList>
                <TabsContent value="credits" className="flex-1 overflow-y-auto mt-0">
                  {renderCreditsContent()}
                </TabsContent>
                <TabsContent value="edit" className="flex-1 overflow-y-auto mt-0">
                  {renderEditContent()}
                  <DialogFooter className="gap-2 mt-4">
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      className="sm:mr-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete')}
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      {t('cancel')}
                    </Button>
                    <Button onClick={handleSave}>
                      {t('save')}
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : (
          <>
            {renderEditContent()}
            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="sm:mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('delete')}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSave}>
                {t('save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
