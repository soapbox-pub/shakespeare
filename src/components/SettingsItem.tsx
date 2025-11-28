import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsItemProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  isActive?: boolean;
  className?: string;
}

export function SettingsItem({
  icon: Icon,
  title,
  onClick,
  isActive = false,
  className,
}: SettingsItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left p-2 rounded-lg transition-colors border',
        {
          'bg-primary/10 border-transparent': isActive,
          'border-transparent hover:bg-muted/50': !isActive,
        },
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn('h-4 w-4 flex-shrink-0', {
          'text-primary': isActive,
          'text-muted-foreground': !isActive,
        })} />
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm', {
            'text-primary': isActive,
            'text-foreground': !isActive,
          })}>
            {title}
          </div>
        </div>
        <ChevronRight className={cn(
          'h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity',
          {
            'text-primary': isActive,
          }
        )} />
      </div>
    </button>
  );
}
