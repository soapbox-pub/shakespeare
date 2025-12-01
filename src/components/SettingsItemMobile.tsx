import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsItemMobileProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function SettingsItemMobile({
  icon: Icon,
  title,
  onClick,
  isFirst = false,
  isLast = false,
}: SettingsItemMobileProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3.5 bg-card text-card-foreground transition-colors active:bg-muted/50',
        'flex items-center gap-3',
        'border-b border-border last:border-b-0',
        {
          'rounded-t-xl': isFirst,
          'rounded-b-xl': isLast,
        }
      )}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base">
          {title}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
    </button>
  );
}
