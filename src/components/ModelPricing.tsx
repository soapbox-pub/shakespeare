import { Decimal } from 'decimal.js';
import { cn } from '@/lib/utils';

interface ModelPricingProps {
  pricing: { prompt: Decimal; completion: Decimal };
  className?: string;
}

/**
 * Get a single normalized "price per token" for a model,
 * combining input and output pricing with agentic-coding-aware weights.
 *
 * Default behavior:
 *   - Uses inputWeight = 0.20 (based on typical 3–5x output premium seen in practice).
 *
 * Optional behavior:
 *   - If you pass observed token usage, the function will compute the weight
 *     as the observed share of spend from inputs over total spend.
 */
function getNormalizedModelPrice(
  pricing: { prompt: Decimal; completion: Decimal },
  inputWeight = 0.2,
): Decimal {
  if (!(inputWeight >= 0 && inputWeight <= 1)) {
    throw new Error("Computed inputWeight is out of range [0,1]. Check inputs.");
  }
  if (pricing.prompt.equals(0) && pricing.completion.equals(0)) {
    return new Decimal(0);
  }
  const outputWeight = 1 - inputWeight;
  return pricing.prompt.times(inputWeight).plus(pricing.completion.times(outputWeight));
}

export function ModelPricing({ pricing, className }: ModelPricingProps) {
  const normalizedPrice = getNormalizedModelPrice(pricing).times(1_000_000).toNumber();

  if (normalizedPrice === 0) {
    return <span className={cn("text-green-600 font-semibold", className)}>Free</span>;
  } else if (normalizedPrice < 10) {
    return <span className={cn("text-green-600 font-semibold", className)}>$</span>;
  } else if (normalizedPrice >= 10 && normalizedPrice < 15) {
    return <span className={cn("text-yellow-600 font-semibold", className)}>$$</span>;
  } else if (normalizedPrice >= 15 && normalizedPrice < 50) {
    return <span className={cn("text-red-600 font-semibold", className)}>$$$</span>;
  } else if (normalizedPrice >= 50) {
    return <span className={cn("text-red-800 font-semibold", className)}>$$$$</span>;
  }

  return null;
}
