import { Badge } from '@/components/ui/badge';
import { useAICredits } from '@/hooks/useAICredits';
import type { AIConnection } from '@/contexts/AISettingsContext';

interface CreditsBadgeProps {
  providerId: string;
  connection: AIConnection;
  className?: string;
  onOpenDialog?: () => void;
}

/**
 * Displays a clickable credits badge showing the remaining credits for an AI provider
 */
export function CreditsBadge({ providerId, connection, className, onOpenDialog }: CreditsBadgeProps) {
  const { data: credits, isLoading, error } = useAICredits(providerId, connection);

  // Don't render anything if there's an error (provider doesn't support credits endpoint)
  if (error || isLoading) {
    return null;
  }

  // Don't render if no credits data is available
  if (!credits) {
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
      className={`cursor-pointer hover:bg-secondary/80 transition-colors ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpenDialog?.();
      }}
    >
      {formattedAmount}
    </Badge>
  );
}