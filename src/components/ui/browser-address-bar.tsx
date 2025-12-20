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
      <form onSubmit={handleSubmit} className="flex-1 mx-auto px-4 max-w-2xl relative">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter path (e.g., /, /about)"
          className="h-8 bg-muted/50 border-muted-foreground/20 focus:bg-background pr-9"
          disabled={!onNavigate}
        />
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="h-6 w-6 p-0 absolute right-5 top-1/2 -translate-y-1/2 hover:bg-transparent"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </form>

      {/* Extra content */}
      {extraContent}
    </div>
  );
}