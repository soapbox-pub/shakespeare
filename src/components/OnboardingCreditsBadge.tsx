import { Badge } from '@/components/ui/badge';
import { AIProvider } from '@/contexts/AISettingsContext';
import { useAICredits } from '@/hooks/useAICredits';

interface OnboardingCreditsBadgeProps {
  provider: AIProvider;
  className?: string;
}

/**
 * Displays a non-clickable credits badge for onboarding showing the remaining credits for an AI provider
 */
export function OnboardingCreditsBadge({ provider, className }: OnboardingCreditsBadgeProps) {
  const { data: credits, isLoading, error } = useAICredits(provider);

  // Don't render anything if there's an error (provider doesn't support credits endpoint)
  if (error || isLoading) {
    return null;
  }

  // Don't render if no credits data is available or if amount is 0
  if (!credits || credits.amount === 0) {
    return null;
  }

  // Format the amount as currency
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(credits.amount);

  return (
    <Badge
      variant="secondary"
      className={`text-xs ${className}`}
    >
      {formattedAmount}
    </Badge>
  );
}