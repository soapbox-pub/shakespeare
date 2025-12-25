import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeviceToggle, type DeviceMode } from '@/components/ui/device-toggle';

interface BrowserAddressBarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onRefresh?: () => void;
  className?: string;
  navigationHistory?: string[];
  deviceMode?: DeviceMode;
  onDeviceModeChange?: (mode: DeviceMode) => void;
}

export function BrowserAddressBar({
  currentPath = '/',
  onNavigate,
  onRefresh,
  className,
  navigationHistory = [],
  deviceMode,
  onDeviceModeChange,
}: BrowserAddressBarProps) {
  const [inputValue, setInputValue] = useState(currentPath);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update input value when currentPath changes (e.g., when iframe navigates)
  useEffect(() => {
    setInputValue(currentPath);
  }, [currentPath]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const dropdownElement = dropdownRef.current;
      const inputElement = inputRef.current;

      if (target && !dropdownElement?.contains(target) && !inputElement?.contains(target)) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onNavigate) return;

    let path = inputValue.trim();

    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    onNavigate(path);
    setShowHistory(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputFocus = () => {
    if (navigationHistory.length > 0) {
      setShowHistory(true);
    }
  };

  const handleHistoryItemClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
      setShowHistory(false);
      inputRef.current?.blur();
    }
  };

  // Get unique history items (reverse to show most recent first, remove duplicates)
  const uniqueHistory = useMemo(() => Array.from(new Set([...navigationHistory].reverse())), [navigationHistory]);

  return (
    <form onSubmit={handleSubmit} className={className}>
      {/* Device toggle on left side - only visible on large screens */}
      {deviceMode && onDeviceModeChange && (
        <div className="hidden md:block absolute left-1 top-1/2 -translate-y-1/2 z-10">
          <DeviceToggle
            mode={deviceMode}
            onModeChange={onDeviceModeChange}
            className="size-6 p-0 hover:bg-muted/50 rounded-full transition-colors group"
          />
        </div>
      )}

      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder="Enter path (e.g., /, /about)"
        className={cn(
          "h-7 text-xs md:text-xs bg-muted/50 border-muted-foreground/20 focus:bg-background rounded-full",
          {
            "md:pl-9": deviceMode && onDeviceModeChange,
            "pr-9": onRefresh,
          }
        )}
        disabled={!onNavigate}
      />

      {/* Refresh button on right side */}
      {onRefresh && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="size-6 absolute right-1 top-1/2 -translate-y-1/2 hover:bg-muted/50 rounded-full transition-colors group px-1.5"
          title="Refresh"
        >
          <RefreshCw className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
        </Button>
      )}

      {/* Navigation history dropdown */}
      {showHistory && uniqueHistory.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-background border rounded-lg shadow-lg overflow-hidden z-50 max-h-64 w-full overflow-y-auto"
        >
          {uniqueHistory.map((path, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleHistoryItemClick(path)}
              className={cn(
                "w-full p-3 text-left text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 border-b last:border-b-0",
                {
                  "bg-muted/30 font-medium": path === currentPath,
                },
              )}
            >
              <span className="truncate">{path}</span>
              {path === currentPath && (
                <CheckIcon className="size-3 text-muted-foreground ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}