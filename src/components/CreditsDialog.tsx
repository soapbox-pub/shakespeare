import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { CreditCard, Zap, ExternalLink, RefreshCw, Check, X, Clock, AlertCircle, Copy, RotateCcw, ArrowLeft, Gift, Plus, History, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/useToast';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { AIProvider } from '@/contexts/AISettingsContext';

interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AIProvider;
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
  onClose: () => void;
}

function LightningPayment({ invoice, amount, onClose }: LightningPaymentProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isWebLNAvailable, setIsWebLNAvailable] = useState(false);
  const [isPayingWithWebLN, setIsPayingWithWebLN] = useState(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const { toast } = useToast();

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

  const handleWebLNPay = async () => {
    if (!window.webln) return;

    try {
      setIsPayingWithWebLN(true);
      await window.webln.enable();
      await window.webln.sendPayment(invoice);

      toast({
        title: 'Payment sent!',
        description: 'Your Lightning payment has been sent successfully.',
      });

      onClose();
    } catch (error) {
      console.error('WebLN payment failed:', error);
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to send Lightning payment',
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Lightning Payment</h3>
        <p className="text-sm text-muted-foreground">
          Pay {formatCurrency(amount)} with Lightning Network
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
            Pay with WebLN
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
            Copy Invoice
          </Button>
          {showCopiedTooltip && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-10 animate-in fade-in-0 duration-200">
              Copied!
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreditsDialog({ open, onOpenChange, provider }: CreditsDialogProps) {
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'lightning'>('stripe');
  const [lightningInvoice, setLightningInvoice] = useState<string | null>(null);
  const [refreshingPayments, setRefreshingPayments] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'buy' | 'giftcards'>('buy');
  const [giftcardAmount, setGiftcardAmount] = useState<number>(10);
  const [giftcardQuantity, setGiftcardQuantity] = useState<number>(1);
  const [redeemCode, setRedeemCode] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Query for payment history
  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
    queryFn: async (): Promise<Payment[]> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      const data = await ai.get('/credits/payments?limit=50') as PaymentsResponse;
      return data.data;
    },
    enabled: open,
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
    enabled: open && activeTab === 'giftcards',
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
        // Open Stripe checkout in new window
        window.open(payment.url, '_blank');
        toast({
          title: 'Payment initiated',
          description: 'Stripe checkout opened in a new window.',
        });
      } else if (payment.method === 'lightning') {
        // Show Lightning payment interface
        setLightningInvoice(payment.url);
      }

      // Refresh payments list
      queryClient.invalidateQueries({
        queryKey: ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      // Refresh credits balance
      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Failed to initiate payment';
      toast({
        title: 'Payment failed',
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
      // Add this payment to the refreshing set
      setRefreshingPayments(prev => new Set(prev).add(paymentId));
    },
    onSuccess: (updatedPayment) => {
      // Remove from refreshing set
      setRefreshingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(updatedPayment.id);
        return newSet;
      });

      // Update the specific payment in the cache instead of refetching
      queryClient.setQueryData<Payment[]>(
        ['ai-payments', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
        (oldPayments) => {
          if (!oldPayments) return oldPayments;
          return oldPayments.map(payment =>
            payment.id === updatedPayment.id ? updatedPayment : payment
          );
        }
      );

      // If payment completed, refresh credits balance
      if (updatedPayment.status === 'completed') {
        queryClient.invalidateQueries({
          queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
        });
        toast({
          title: 'Payment completed!',
          description: `${formatCurrency(updatedPayment.amount)} has been added to your account.`,
        });
      } else if (updatedPayment.status === 'failed') {
        toast({
          title: 'Payment failed',
          description: 'The payment has failed. Please try again.',
          variant: 'destructive',
        });
      } else if (updatedPayment.status === 'expired') {
        toast({
          title: 'Payment expired',
          description: 'The payment has expired. Please create a new payment.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error, paymentId: string) => {
      // Remove from refreshing set on error
      setRefreshingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });

      const errorMessage = error?.message || 'Failed to check payment status';
      toast({
        title: 'Refresh failed',
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
        title: 'Gift Cards created!',
        description: `Successfully created ${giftcards.length} gift card${giftcards.length > 1 ? 's' : ''}.`,
      });

      // Refresh gift cards list
      queryClient.invalidateQueries({
        queryKey: ['ai-giftcards', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      // Refresh credits balance
      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      // Reset form
      setGiftcardAmount(10);
      setGiftcardQuantity(1);
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Failed to create gift cards';
      toast({
        title: 'Creation failed',
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
        title: 'Gift Card redeemed!',
        description: `${formatCurrency(redemption.amount)} has been added to your account.`,
      });

      // Refresh credits balance
      queryClient.invalidateQueries({
        queryKey: ['ai-credits', provider.nostr ? user?.pubkey ?? '' : '', provider.id],
      });

      // Reset redeem code
      setRedeemCode('');
    },
    onError: (error: Error) => {
      const errorMessage = error?.message || 'Failed to redeem gift card';
      toast({
        title: 'Redemption failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleAddCredits = () => {
    if (amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    const request: AddCreditsRequest = {
      amount,
      method: paymentMethod,
    };

    if (paymentMethod === 'stripe') {
      request.redirect_url = window.location.origin + '/settings/ai';
    }

    addCreditsMutation.mutate(request);
  };

  const handleCreateGiftcard = () => {
    if (giftcardAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    if (giftcardQuantity <= 0 || giftcardQuantity > 100) {
      toast({
        title: 'Invalid quantity',
        description: 'Quantity must be between 1 and 100.',
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
        title: 'Invalid code',
        description: 'Please enter a gift card code.',
        variant: 'destructive',
      });
      return;
    }

    redeemGiftcardMutation.mutate({ code: trimmedCode });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
      return 'Yesterday';
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

  const getStatusVariant = (status: Payment['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'expired':
        return 'secondary';
      case 'pending':
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-lg w-full max-h-[75vh] overflow-hidden flex flex-col sm:max-w-lg sm:max-h-[75vh] max-sm:w-full max-sm:h-dvh-safe max-sm:max-w-none max-sm:max-h-none max-sm:m-0 max-sm:rounded-none">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {lightningInvoice ? (
              <>
                <button
                  onClick={() => setLightningInvoice(null)}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back
                </button>
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Credits
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Lightning Payment Interface */}
        {lightningInvoice ? (
          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            <LightningPayment
              invoice={lightningInvoice}
              amount={amount}
              onClose={() => setLightningInvoice(null)}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={(value: 'buy' | 'giftcards') => setActiveTab(value)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0 mb-4">
                <TabsTrigger value="buy" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Buy Credits
                </TabsTrigger>
                <TabsTrigger value="giftcards" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Gift Cards
                </TabsTrigger>
              </TabsList>

              {/* Buy Credits Tab */}
              <TabsContent value="buy" className="flex-1 overflow-y-auto mt-0 px-1 -mx-1">
                <Accordion type="multiple" className="w-full">
                  {/* Buy Credits Accordion */}
                  <AccordionItem value="add">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Buy Credits
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <div className="space-y-3">
                          <Label htmlFor="amount" className="text-sm font-medium">Amount (USD)</Label>
                          <div className="space-y-3">
                            <Input
                              id="amount"
                              type="number"
                              step="0.01"
                              value={amount}
                              onChange={(e) => setAmount(Number(e.target.value))}
                              placeholder="Enter amount"
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
                          <Label className="text-sm font-medium">Payment Method</Label>
                          <Tabs value={paymentMethod} onValueChange={(value: 'stripe' | 'lightning') => setPaymentMethod(value)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="stripe" className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                              Credit Card
                              </TabsTrigger>
                              <TabsTrigger value="lightning" className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                              Lightning
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>

                        <Button
                          onClick={handleAddCredits}
                          disabled={amount <= 0 || addCreditsMutation.isPending}
                          className="w-full h-12 text-base font-medium"
                          size="lg"
                        >
                          {addCreditsMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                          {paymentMethod === 'stripe' ? 'Pay with Card' : 'Generate Invoice'}
                          {amount > 0 && ` - ${formatCurrency(amount)}`}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Transaction History Accordion */}
                  <AccordionItem value="history" className="border-b-0">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Recent Transactions
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="pt-2">
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
                            <p className="text-sm">No transactions yet</p>
                            <p className="text-xs">Your payment history will appear here</p>
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
                                      {payment.method === 'stripe' ? 'Credit Card' : 'Lightning'}
                                    </span>
                                    <Badge variant={getStatusVariant(payment.status)} className="text-xs flex-shrink-0">
                                      {payment.status}
                                    </Badge>
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
                                            } else {
                                              window.open(payment.url, '_blank');
                                            }
                                          }}
                                          className="h-6 px-2 text-xs"
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          {payment.method === 'lightning' ? 'Pay' : 'Pay'}
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
                </Accordion>
              </TabsContent>

              {/* Gift Cards Tab */}
              <TabsContent value="giftcards" className="flex-1 overflow-y-auto mt-0 px-1 -mx-1">
                <Accordion type="multiple" className="w-full">
                  {/* Redeem Gift Card Accordion */}
                  <AccordionItem value="redeem">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Redeem Gift Card
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <div className="flex gap-2">
                          <Input
                            id="redeem-code"
                            type="text"
                            value={redeemCode}
                            onChange={(e) => setRedeemCode(e.target.value)}
                            placeholder="Enter gift card code"
                            className="flex-1"
                          />
                          <Button
                            onClick={handleRedeemGiftcard}
                            disabled={!redeemCode.trim() || redeemGiftcardMutation.isPending}
                            size="lg"
                          >
                            {redeemGiftcardMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                            Redeem
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Create Gift Card Accordion */}
                  <AccordionItem value="create">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Create Gift Card
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor="giftcard-amount" className="text-xs text-muted-foreground">Amount (USD)</Label>
                            <Input
                              id="giftcard-amount"
                              type="number"
                              step="0.01"
                              value={giftcardAmount}
                              onChange={(e) => setGiftcardAmount(Number(e.target.value))}
                              placeholder="Amount"
                              className="text-center"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="giftcard-quantity" className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              id="giftcard-quantity"
                              type="number"
                              min="1"
                              max="100"
                              value={giftcardQuantity}
                              onChange={(e) => setGiftcardQuantity(Number(e.target.value))}
                              placeholder="Qty"
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
                          Create {giftcardQuantity > 1 ? `${giftcardQuantity} ` : ''}Gift Card{giftcardQuantity > 1 ? 's' : ''}
                          {giftcardAmount > 0 && giftcardQuantity > 0 && ` - ${formatCurrency(giftcardAmount * giftcardQuantity)}`}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Your Gift Cards Accordion */}
                  <AccordionItem value="list" className="border-b-0">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Your Gift Cards
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="pt-2">
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
                            <p className="text-sm">No gift cards yet</p>
                            <p className="text-xs">Create gift cards to share with others</p>
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
                                      Gift Card
                                    </span>
                                    <Badge variant={giftcard.redeemed ? "secondary" : "default"} className="text-xs flex-shrink-0">
                                      {giftcard.redeemed ? 'Redeemed' : 'Active'}
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
                                      Copy
                                    </Button>
                                    {copiedCode === giftcard.code && (
                                      <div className="absolute -top-8 right-0 bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg z-10 animate-in fade-in-0 duration-200 whitespace-nowrap">
                                        Copied!
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {giftcard.created_at && (
                                  <div className="text-xs text-muted-foreground">
                                    Created {formatDate(giftcard.created_at)}
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
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}