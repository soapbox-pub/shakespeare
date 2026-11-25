/** Buying credits from a provider that sells them (the Shakespeare AI API's `/credits` endpoints). */

export type PaymentMethodId = 'stripe' | 'lightning' | 'bitcoin';

/** What credits can be bought with, and on what terms (`GET /credits/methods`). */
export interface PaymentMethods {
  object: 'list';
  /** `confirmations`, for bitcoin: how deep a payment must be to be credited. */
  data: { object: 'payment_method'; id: PaymentMethodId; requires_redirect_url?: boolean; confirmations?: number }[];
  minimum_amount: number;
  /** A fraction of the amount: 0.1 is 10%. */
  fee: number;
}

export interface Payment {
  object: 'payment';
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  amount: number;
  fee: number;
  total: number;
  method: PaymentMethodId;
  description: string;
  /** Stripe's checkout page, a BOLT11 invoice, or a BIP21 `bitcoin:` URI. */
  url: string;
  created_at: number;
  completed_at?: number;
  expires_at: number;
  /**
   * A bitcoin payment's sats: what it asks for and what's been sent so far, the mempool included; and, for an
   * account that's paid before, the credit it can already spend while that confirms.
   */
  bitcoin?: { sats: number; received: number; advanced?: number };
}

export interface PaymentsResponse {
  object: 'list';
  data: Payment[];
  has_more: boolean;
  url: string;
}

/** The methods we know how to pay with, in the order they're offered. */
const KNOWN_METHODS: PaymentMethodId[] = ['stripe', 'lightning', 'bitcoin'];

/** The methods a provider takes that we can pay with. */
export function availableMethods(methods: PaymentMethods | undefined): PaymentMethodId[] {
  const offered = new Set(methods?.data.map((m) => m.id));
  return KNOWN_METHODS.filter((id) => offered.has(id));
}

/** The fee on `amount`, as the server works it out: rounded to the cent, half away from zero. */
export function feeFor(amount: number, rate: number): number {
  return Math.round(amount * rate * 100 + Number.EPSILON) / 100;
}

/** Whether a bitcoin payment has been sent money that's waiting to confirm. */
export function isConfirming(payment: Payment): boolean {
  return payment.method === 'bitcoin' && payment.status !== 'completed' && (payment.bitcoin?.received ?? 0) > 0;
}

/** Whether a payment can still change: one that's open, or sent bitcoin that's still confirming. */
export function isUnsettled(payment: Payment): boolean {
  return payment.status === 'pending' || isConfirming(payment);
}

/** Payments worth listing: paid, still payable, or sent bitcoin. Unpaid expired ones are noise. */
export function isWorthListing(payment: Payment): boolean {
  return payment.status === 'completed' || payment.status === 'pending' || isConfirming(payment);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
