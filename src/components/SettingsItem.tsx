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
        'group w-full text-left p-2 rounded-lg transition-all duration-200 border',
        {
          'bg-primary/10 border-primary/20 shadow-sm': isActive,
          'border-transparent hover:bg-muted/60 hover:shadow-sm': !isActive,
        },
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-1.5 rounded-md transition-all duration-200',
          {
            'bg-primary/10': isActive,
            'group-hover:bg-primary/5': !isActive,
          }
        )}>
          <Icon className={cn('h-4 w-4 flex-shrink-0 transition-colors duration-200', {
            'text-primary': isActive,
            'text-muted-foreground group-hover:text-foreground': !isActive,
          })} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-medium transition-colors duration-200', {
            'text-primary': isActive,
            'text-foreground': !isActive,
          })}>
            {title}
          </div>
        </div>
        <ChevronRight className={cn(
          'h-4 w-4 flex-shrink-0 transition-all duration-200',
          'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0',
          {
            'text-primary opacity-60': isActive,
            'text-muted-foreground': !isActive,
          }
        )} />
      </div>
    </button>
  );
}
