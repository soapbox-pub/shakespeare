import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';

interface DuplicateProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: DuplicateProjectDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const projectsManager = useProjectsManager();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState(`${projectName}-copy`);
  const [isLoading, setIsLoading] = useState(false);

  const handleDuplicate = async () => {
    if (!newName.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const duplicatedProject = await projectsManager.duplicateProject(projectId, newName);

      // Invalidate projects query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast({
        title: t('projectDuplicated'),
        description: t('projectDuplicatedDescription'),
      });

      // Close dialog
      onOpenChange(false);

      // Navigate to the new project
      navigate(`/project/${duplicatedProject.id}`);
    } catch (error) {
      console.error('Failed to duplicate project:', error);
      toast({
        title: t('failedToDuplicateProject'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('duplicateProject')}</DialogTitle>
          <DialogDescription>
            {t('duplicateProjectDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-name">{t('newProjectName')}</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`${projectName}-copy`}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  handleDuplicate();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={isLoading || !newName.trim()}
          >
            {isLoading ? t('duplicatingProject') : t('duplicateProject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
