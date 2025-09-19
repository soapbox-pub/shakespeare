import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Zap, ExternalLink, RefreshCw, Check, X, Clock, AlertCircle } from 'lucide-react';
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

export function CreditsDialog({ open, onOpenChange, providerId, connection }: CreditsDialogProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number>(10);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'lightning'>('stripe');

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
        // Copy Lightning invoice to clipboard
        navigator.clipboard.writeText(payment.url);
        toast({
          title: 'Lightning invoice copied',
          description: 'The Lightning invoice has been copied to your clipboard.',
        });
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

    if (amount < 5) {
      toast({
        title: 'Minimum amount',
        description: 'Minimum credit amount is $5.00',
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
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp * 1000));
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credits - {providerId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Credits Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Add Credits</h3>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="number"
                    min="5"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="Enter amount"
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    {PRESET_AMOUNTS.map((preset) => (
                      <Button
                        key={preset}
                        variant={amount === preset ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAmount(preset)}
                        className="px-3"
                      >
                        ${preset}
                      </Button>
                    ))}
                  </div>
                </div>
                {amount > 0 && amount < 5 && (
                  <p className="text-sm text-destructive">Minimum amount is $5.00</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value: 'stripe' | 'lightning') => setPaymentMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Credit Card (Stripe)
                      </div>
                    </SelectItem>
                    <SelectItem value="lightning">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Lightning Network
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAddCredits}
                disabled={!user || amount < 5 || addCreditsMutation.isPending}
                className="w-full"
              >
                {addCreditsMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {paymentMethod === 'stripe' ? 'Pay with Credit Card' : 'Generate Lightning Invoice'}
                {amount >= 5 && ` - ${formatCurrency(amount)}`}
              </Button>

              {!user && (
                <p className="text-sm text-muted-foreground text-center">
                  Please log in to purchase credits
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Transaction History */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Transaction History</h3>

            {isLoadingPayments ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4 rounded" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !payments || payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Your payment history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(payment.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{payment.description}</span>
                          <Badge variant={getStatusVariant(payment.status)} className="text-xs">
                            {payment.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payment.created_at)}
                          {payment.completed_at && payment.completed_at !== payment.created_at && (
                            <span> • Completed {formatDate(payment.completed_at)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(payment.amount)}</p>
                      {payment.fee > 0 && (
                        <p className="text-sm text-muted-foreground">
                          +{formatCurrency(payment.fee)} fee
                        </p>
                      )}
                      {payment.status === 'pending' && payment.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (payment.method === 'lightning') {
                              navigator.clipboard.writeText(payment.url);
                              toast({
                                title: 'Invoice copied',
                                description: 'Lightning invoice copied to clipboard',
                              });
                            } else {
                              window.open(payment.url, '_blank');
                            }
                          }}
                          className="h-6 px-2 mt-1"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {payment.method === 'lightning' ? 'Copy' : 'Pay'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}