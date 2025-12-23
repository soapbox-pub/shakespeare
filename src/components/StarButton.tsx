import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface StarButtonProps {
  projectId: string;
  projectName: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
  showToast?: boolean;
}

export function StarButton({
  projectId,
  projectName,
  className,
  size = 'sm',
  variant = 'ghost',
  showToast = true
}: StarButtonProps) {
  const [favorites, setFavorites] = useLocalStorage<string[]>('project-favorites', []);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isFavorite = favorites.includes(projectId);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click events

    const newFavorites = isFavorite
      ? favorites.filter(id => id !== projectId)
      : [...favorites, projectId];

    setFavorites(newFavorites);

    // Invalidate the projects query to trigger a refetch with new sorting
    queryClient.invalidateQueries({ queryKey: ['projects'] });

    if (showToast) {
      toast({
        title: isFavorite ? "Project Unfavorited" : "Project Favorited",
        description: `"${projectName}" has been ${isFavorite ? 'removed from' : 'added to'} your favorites.`,
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      className={cn(
        "h-8 w-8 p-0",
        className
      )}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          "size-5",
          isFavorite ? "text-yellow-500 fill-current" : "text-muted-foreground hover:text-yellow-500"
        )}
      />
    </Button>
  );
}