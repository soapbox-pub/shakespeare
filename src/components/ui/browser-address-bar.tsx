import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BrowserAddressBarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onRefresh?: () => void;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  className?: string;
  extraContent?: ReactNode;
}

export function BrowserAddressBar({
  currentPath = '/',
  onNavigate,
  onRefresh,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
  className,
  extraContent,
}: BrowserAddressBarProps) {
  const [inputValue, setInputValue] = useState(currentPath);

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
      "flex items-center gap-1 p-2 border-b bg-background w-full",
      className
    )}>
      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={!canGoBack || !onBack}
          className="h-8 w-8 p-0"
          title="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onForward}
          disabled={!canGoForward || !onForward}
          className="h-8 w-8 p-0"
          title="Go forward"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={!onRefresh}
          className="h-8 w-8 p-0"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Address bar */}
      <form onSubmit={handleSubmit} className="flex-1 mx-auto px-2 max-w-2xl">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Enter path (e.g., /, /about)"
          className="h-8 bg-muted/50 border-muted-foreground/20 focus:bg-background"
          disabled={!onNavigate}
        />
      </form>

      {/* Extra content */}
      {extraContent}
    </div>
  );
}