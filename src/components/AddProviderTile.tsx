import { Plus } from 'lucide-react';

interface AddProviderTileProps {
  onClick: () => void;
  label?: string;
}

export function AddProviderTile({ onClick, label = 'Add Custom' }: AddProviderTileProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-dashed bg-card hover:bg-muted transition-colors text-center min-h-[100px]"
    >
      <Plus size={32} className="text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground overflow-hidden max-w-full text-ellipsis">
        {label}
      </span>
    </button>
  );
}
