import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  MessageSquarePlus,
  History,
  Folder,
  Rocket,
  Copy,
} from 'lucide-react';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { DeployDialog } from '@/components/DeployDialog';
import { DuplicateProjectDialog } from '@/components/DuplicateProjectDialog';

interface ActionsMenuProps {
  projectId: string;
  projectName: string;
  onNewChat: () => void;
  onProjectDetails?: () => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  disabled?: boolean;
  onFirstInteraction?: () => void;
}

export function ActionsMenu({
  projectId,
  projectName,
  onNewChat,
  onProjectDetails,
  isLoading = false,
  isBuildLoading = false,
  disabled = false,
  onFirstInteraction: _onFirstInteraction,
}: ActionsMenuProps) {
  const { t } = useTranslation();
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  const isAnyLoading = isLoading || isBuildLoading;



  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={disabled}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={onNewChat}
            disabled={isLoading}
            className="gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New Chat
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setGitHistoryOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Rollback
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setDeployDialogOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            Deploy
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setDuplicateDialogOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            {t('duplicateProject')}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onProjectDetails}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <Folder className="h-4 w-4" />
            Project Details
          </DropdownMenuItem>


        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <GitHistoryDialog
        projectId={projectId}
        open={gitHistoryOpen}
        onOpenChange={setGitHistoryOpen}
      />

      <DeployDialog
        projectId={projectId}
        projectName={projectName}
        open={deployDialogOpen}
        onOpenChange={setDeployDialogOpen}
      />

      <DuplicateProjectDialog
        projectId={projectId}
        projectName={projectName}
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

    </>
  );
}