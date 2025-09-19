import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { CreditCard, Zap, ExternalLink, RefreshCw, Check, X, Clock, AlertCircle, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';
import { createAIClient } from '@/lib/ai-client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { AIConnection } from '@/contexts/AISettingsContext';

interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  connection: AIConnection;
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

      {/* Invoice Text (for manual copying) */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Lightning Invoice:</Label>
        <div className="p-2 bg-muted rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
          {invoice}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Close
        </Button>
      </div>
    </div>
  );
}

export function CreditsDialog({ open, onOpenChange, providerId, connection }: CreditsDialogProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'lightning'>('stripe');
  const [lightningInvoice, setLightningInvoice] = useState<string | null>(null);

  // Query for payment history
  const { data: payments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['ai-payments', connection.nostr ? user?.pubkey ?? '' : '', providerId],
    queryFn: async (): Promise<Payment[]> => {
      const ai = createAIClient(connection, user);
      const data = await ai.get('/credits/payments?limit=50') as PaymentsResponse;
      return data.data;
    },
    enabled: open && !!user,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Mutation for adding credits
  const addCreditsMutation = useMutation({
    mutationFn: async (request: AddCreditsRequest): Promise<Payment> => {
      const ai = createAIClient(connection, user);
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
        queryKey: ['ai-payments', connection.nostr ? user?.pubkey ?? '' : '', providerId],
      });

      // Refresh credits balance
      queryClient.invalidateQueries({
        queryKey: ['ai-credits', connection.nostr ? user?.pubkey ?? '' : '', providerId],
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

  const handleAddCredits = () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to purchase credits.',
        variant: 'destructive',
      });
      return;
    }

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
      <DialogContent className="max-w-lg w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Credits
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 px-1 -mx-1">
          {/* Lightning Payment Interface */}
          {lightningInvoice ? (
            <LightningPayment
              invoice={lightningInvoice}
              amount={amount}
              onClose={() => {
                setLightningInvoice(null);
                onOpenChange(false);
              }}
            />
          ) : (
            <>
              {/* Add Credits Form */}
              <div className="space-y-4">
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
              <Label htmlFor="payment-method" className="text-sm font-medium">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(value: 'stripe' | 'lightning') => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Credit Card
                    </div>
                  </SelectItem>
                  <SelectItem value="lightning">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Lightning
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAddCredits}
              disabled={!user || amount <= 0 || addCreditsMutation.isPending}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {addCreditsMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              {paymentMethod === 'stripe' ? 'Pay with Card' : 'Generate Invoice'}
              {amount > 0 && ` - ${formatCurrency(amount)}`}
            </Button>

            {!user && (
              <p className="text-sm text-muted-foreground text-center px-4">
                Please log in to purchase credits
              </p>
            )}
          </div>

          <Separator />

          {/* Transaction History */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Recent Transactions</h3>

            {isLoadingPayments ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </div>
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : !payments || payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs">Your payment history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.slice(0, 5).map((payment) => (
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
                      {payment.status === 'pending' && payment.url && (
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
                  </div>
                ))}

                {payments.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Showing recent 5 transactions
                  </p>
                )}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}