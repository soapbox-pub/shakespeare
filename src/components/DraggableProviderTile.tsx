import { Bot, GripVertical } from 'lucide-react';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggableProviderTileProps {
  id: string;
  icon?: ReactNode;
  iconUrl?: string | null;
  name: string;
  onClick: () => void;
  badge?: ReactNode;
}

export function DraggableProviderTile({ id, icon, iconUrl, name, onClick, badge }: DraggableProviderTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border bg-card hover:bg-muted transition-colors text-center h-[120px] w-full relative"
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
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 right-1 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded hover:bg-muted"
        title="Drag to reorder"
      >
        <GripVertical size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
}
