import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BrowserAddressBarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onRefresh?: () => void;
  className?: string;
  extraContent?: ReactNode;
  leftContent?: ReactNode;
}

export function BrowserAddressBar({
  currentPath = '/',
  onNavigate,
  onRefresh,
  className,
  extraContent,
  leftContent,
}: BrowserAddressBarProps) {
  const [inputValue, setInputValue] = useState(currentPath);

  // Update input value when currentPath changes (e.g., when iframe navigates)
  useEffect(() => {
    setInputValue(currentPath);
  }, [currentPath]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onNavigate) return;

    let path = inputValue.trim();

    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    onNavigate(path);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 border-b bg-background w-full",
      className
    )}>
      {/* Left content (e.g., maximize button) */}
      {leftContent}

      {/* Address bar with refresh button inside */}
      <form onSubmit={handleSubmit} className="flex-1 mx-auto px-6 max-w-80 relative">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter path (e.g., /, /about)"
          className="h-7 text-xs md:text-xs bg-muted/50 border-muted-foreground/20 focus:bg-background pr-9 rounded-full"
          disabled={!onNavigate}
        />
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="size-6 absolute right-7 top-1/2 -translate-y-1/2 hover:bg-muted/50 rounded-full transition-colors group"
            title="Refresh"
          >
            <RefreshCw className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
          </Button>
        )}
      </form>

      {/* Extra content */}
      {extraContent}
    </div>
  );
}