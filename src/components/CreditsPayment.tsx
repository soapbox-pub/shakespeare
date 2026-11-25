import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { AlertCircle, Clock, Copy, ExternalLink, Hourglass, Check, RefreshCw, Wallet, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useAIPaymentMethods } from '@/hooks/useAIPaymentMethods';
import { createAIClient } from '@/lib/ai-client';
import { formatUSD, isConfirming, isUnsettled, type Payment } from '@/lib/aiPayments';
import type { AIProvider } from '@/contexts/AISettingsContext';

const SATS = 100_000_000;

interface CreditsPaymentProps {
  payment: Payment;
  provider: AIProvider;
  /** Called once the payment is paid and credited. */
  onPaymentCompleted: () => void;
}

/** How to pay a Lightning or bitcoin payment, kept up to date until it's paid or expires. */
export function CreditsPayment({ payment: initial, provider, onPaymentCompleted }: CreditsPaymentProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const account = provider.nostr ? user?.pubkey ?? '' : '';
  const last = useRef<Payment>(initial);

  // Asking about a payment makes the server check on it there and then
  // (a bitcoin address at most every 10 seconds), so it's worth asking often.
  const { data } = useQuery({
    queryKey: ['ai-payment', account, provider.id, initial.id],
    queryFn: async (): Promise<Payment> => {
      const ai = createAIClient(provider, user, config.corsProxy);
      return await ai.get(`/credits/payments/${encodeURIComponent(initial.id)}`) as Payment;
    },
    initialData: initial,
    initialDataUpdatedAt: 0,
    refetchInterval: (query) => {
      const current = query.state.data;
      if (current && !isUnsettled(current)) return false;
      return initial.method === 'bitcoin' ? 10_000 : 3_000;
    },
    refetchOnWindowFocus: true,
    retry: false,
  });
  const payment = data ?? initial;

  // Paid, expired, or sent bitcoin: the balance and history show it.
  useEffect(() => {
    const before = last.current;
    last.current = payment;
    if (payment.status === before.status && payment.bitcoin?.received === before.bitcoin?.received) return;

    queryClient.invalidateQueries({ queryKey: ['ai-credits', account, provider.id] });
    queryClient.invalidateQueries({ queryKey: ['ai-payments', account, provider.id] });

    if (payment.status === 'completed') {
      toast({
        title: t('paymentCompleted'),
        description: t('creditsAddedToAccount', { amount: formatUSD(payment.amount) }),
      });
      onPaymentCompleted();
    } else if (payment.status === 'failed') {
      toast({ title: t('paymentFailed'), variant: 'destructive' });
    }
  }, [payment, account, provider.id, queryClient, toast, t, onPaymentCompleted]);

  const bitcoin = payment.bitcoin;
  // Paid in full, or paid short and out of time for a top-up: all that's
  // left is for it to confirm.
  if (bitcoin && isConfirming(payment) && (bitcoin.received >= bitcoin.sats || payment.status === 'expired')) {
    return <BitcoinConfirming payment={payment} sats={bitcoin} provider={provider} />;
  }

  if (payment.status === 'completed') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Check className="h-12 w-12 text-green-600" aria-hidden />
        <p className="text-lg font-medium">{t('creditsAddedToAccount', { amount: formatUSD(payment.amount) })}</p>
      </div>
    );
  }

  if (payment.status === 'expired' || payment.status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        {payment.status === 'expired'
          ? <Clock className="h-12 w-12 text-muted-foreground" aria-hidden />
          : <AlertCircle className="h-12 w-12 text-destructive" aria-hidden />}
        <p className="text-lg font-medium">{payment.status === 'expired' ? t('paymentExpired') : t('paymentFailed')}</p>
        <p className="text-sm text-muted-foreground">
          {payment.method === 'bitcoin' ? t('bitcoinExpiredMessage') : t('paymentExpiredMessage')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">
          {payment.method === 'bitcoin' ? t('bitcoinPayment') : t('lightningPayment')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {payment.method === 'bitcoin'
            ? t('payWithBitcoin', { amount: formatUSD(payment.total) })
            : t('payWithLightning', { amount: formatUSD(payment.total) })}
        </p>
      </div>

      {payment.method === 'bitcoin'
        ? <BitcoinPayment uri={payment.url} sats={payment.bitcoin} />
        : <LightningPayment invoice={payment.url} />}

      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
        {payment.bitcoin?.received ? t('waitingForRest') : t('waitingForPayment')}
      </p>
    </div>
  );
}

function QRCodeImage({ value, alt, href }: { value: string; alt: string; href: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(value, { width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(console.error);
  }, [value]);

  return (
    <div className="flex justify-center">
      {dataUrl ? (
        <a href={href} className="p-4 bg-white rounded-lg border" aria-label={alt}>
          <img src={dataUrl} alt={alt} className="w-48 h-48" />
        </a>
      ) : (
        <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}

/** A value to copy, such as an address or an amount, with its label. */
function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-xs bg-muted px-2 py-2 rounded font-mono" title={value}>{value}</code>
        <Button variant="outline" size="sm" onClick={copy} aria-label={`${t('copy')} ${label}`}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function LightningPayment({ invoice }: { invoice: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isPayingWithWebLN, setIsPayingWithWebLN] = useState(false);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const isWebLNAvailable = typeof window !== 'undefined' && !!window.webln;
  const uri = `lightning:${invoice}`;

  const handleWebLNPay = async () => {
    if (!window.webln) return;

    try {
      setIsPayingWithWebLN(true);
      await window.webln.enable();
      await window.webln.sendPayment(invoice);
      toast({ title: t('paymentSent'), description: t('lightningPaymentSent') });
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
    <>
      <QRCodeImage value={uri.toUpperCase()} href={uri} alt={t('lightningInvoiceQRCode')} />

      <div className="space-y-2">
        {isWebLNAvailable && (
          <Button onClick={handleWebLNPay} disabled={isPayingWithWebLN} className="w-full" size="lg">
            {isPayingWithWebLN && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            <Zap className="h-4 w-4 mr-2" />
            {t('payWithWebLN')}
          </Button>
        )}

        <div className="relative">
          <Button variant="outline" onClick={handleCopyInvoice} className="w-full" size="lg">
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

        <Button asChild variant="outline" className="w-full" size="lg">
          <a href={uri}>
            <Wallet className="h-4 w-4 mr-2" />
            {t('openInWallet')}
          </a>
        </Button>
      </div>
    </>
  );
}

function BitcoinPayment({ uri, sats }: { uri: string; sats?: Payment['bitcoin'] }) {
  const { t } = useTranslation();
  const parsed = new URL(uri);
  const address = parsed.pathname;
  // Paid short: ask for the rest.
  const rest = sats && sats.received > 0 && sats.received < sats.sats ? sats.sats - sats.received : undefined;
  const amount = rest ? (rest / SATS).toFixed(8).replace(/\.?0+$/, '') : parsed.searchParams.get('amount');
  const href = rest ? uri.replace(/([?&]amount=)[^&]*/, `$1${amount}`) : uri;

  return (
    <>
      <QRCodeImage value={href} href={href} alt={t('bitcoinPaymentQRCode')} />

      <div className="space-y-3">
        <CopyField label={t('bitcoinAddress')} value={address} />
        {amount && <CopyField label={rest ? t('bitcoinStillToSend') : t('bitcoinAmount')} value={amount} />}

        <Alert>
          <AlertDescription>
            {rest && sats
              ? t('bitcoinPartiallyPaid', { received: sats.received.toLocaleString(), sats: sats.sats.toLocaleString() })
              : t('bitcoinSendExactly')}
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="w-full" size="lg">
          <a href={href}>
            <Wallet className="h-4 w-4 mr-2" />
            {t('openInWallet')}
          </a>
        </Button>
      </div>
    </>
  );
}

function BitcoinConfirming({ payment, sats, provider }: { payment: Payment; sats: NonNullable<Payment['bitcoin']>; provider: AIProvider }) {
  const { t } = useTranslation();
  const methods = useAIPaymentMethods(provider);
  const confirmations = methods.data?.data.find((m) => m.id === 'bitcoin')?.confirmations ?? 1;
  const address = new URL(payment.url).pathname;
  const short = sats.received < sats.sats;
  // What it will credit: its share of what it asked for.
  const credit = (payment.amount * sats.received) / sats.sats;

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Hourglass className="h-12 w-12 text-primary motion-safe:animate-pulse" aria-hidden />
      <p className="text-lg font-medium">{t('paymentReceived')}</p>
      <p className="text-sm text-muted-foreground">
        {t('bitcoinConfirming', {
          amount: formatUSD(credit),
          confirmations: confirmations === 1 ? t('oneConfirmation') : t('nConfirmations', { count: confirmations }),
        })}
      </p>
      {sats.advanced ? (
        <p className="text-sm text-muted-foreground">{t('bitcoinAdvanced', { amount: formatUSD(sats.advanced) })}</p>
      ) : null}
      {short && (
        <p className="text-sm text-muted-foreground">
          {t('bitcoinPaidShort', { received: sats.received.toLocaleString(), sats: sats.sats.toLocaleString() })}
        </p>
      )}
      {address.startsWith('bc1') && (
        <Button asChild variant="outline" size="sm">
          <a href={`https://mempool.space/address/${address}`} target="_blank" rel="noreferrer">
            {t('viewOnMempool')}
            <ExternalLink className="h-4 w-4 ml-2" />
          </a>
        </Button>
      )}
    </div>
  );
}
