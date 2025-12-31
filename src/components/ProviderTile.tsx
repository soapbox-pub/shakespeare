import { Bot } from 'lucide-react';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { ReactNode } from 'react';

interface ProviderTileProps {
  icon?: ReactNode;
  iconUrl?: string | null;
  name: string;
  onClick: () => void;
  badge?: ReactNode;
}

export function ProviderTile({ icon, iconUrl, name, onClick, badge }: ProviderTileProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border bg-card hover:bg-muted transition-colors text-center min-h-[100px] relative"
    >
      {iconUrl ? (
        <ExternalFavicon
          url={iconUrl}
          size={32}
          fallback={icon || <Bot size={32} />}
        />
      ) : (
        icon || <Bot size={32} />
      )}
      <span className="text-sm font-medium line-clamp-2 overflow-hidden max-w-full text-ellipsis">
        {name}
      </span>
      {badge && (
        <div className="absolute top-0 right-0">
          {badge}
        </div>
      )}
    </button>
  );
}
