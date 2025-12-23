import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquarePlus,
  History,
  Folder,
  Copy,
  ChevronDown,
  Download,
  Trash2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';

interface ProjectTitleMenuProps {
  projectId: string;
  projectName: string;
  onNewChat: () => void;
  onGitHistory: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  onProjectDetails: () => void;
  isAILoading: boolean;
  isAnyLoading: boolean;
  className?: string;
}

export function ProjectTitleMenu({
  projectId,
  projectName,
  onNewChat,
  onGitHistory,
  onDuplicate,
  onExport,
  onDelete,
  onProjectDetails,
  isAILoading,
  isAnyLoading,
  className = '',
}: ProjectTitleMenuProps) {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useLocalStorage<string[]>('project-favorites', []);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isFavorite = favorites.includes(projectId);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent menu from closing
    e.stopPropagation();

    const newFavorites = isFavorite
      ? favorites.filter(id => id !== projectId)
      : [...favorites, projectId];

    setFavorites(newFavorites);

    // Invalidate the projects query to trigger a refetch with new sorting
    queryClient.invalidateQueries({ queryKey: ['projects'] });

    toast({
      title: isFavorite ? "Project Unfavorited" : "Project Favorited",
      description: `"${projectName}" has been ${isFavorite ? 'removed from' : 'added to'} your favorites.`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("p-0 h-auto font-semibold truncate hover:bg-transparent hover:text-muted-foreground flex items-center gap-1", className)}
        >
          <span className="truncate">{projectName}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={handleToggleFavorite}
          disabled={isAnyLoading}
          className="gap-2"
          onSelect={(e) => e.preventDefault()} // Prevent menu from closing
        >
          <Star
            className={cn(
              "h-4 w-4",
              { "text-yellow-500 fill-current": isFavorite },
            )}
          />
          {isFavorite ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onProjectDetails}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <Folder className="h-4 w-4" />
          Project Details
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onGitHistory}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          Rollback
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onNewChat}
          disabled={isAILoading}
          className="gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDuplicate}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {t('duplicateProject')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onExport}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export Project
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDelete}
          disabled={isAnyLoading}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
