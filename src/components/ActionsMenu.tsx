import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GitBranch,
  MoreHorizontal,
  MessageSquarePlus,
  History,
} from 'lucide-react';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { GitDialog } from '@/components/GitDialog';

interface ActionsMenuProps {
  projectId: string;
  projectName: string;
  onNewChat: () => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  disabled?: boolean;
  onFirstInteraction?: () => void;
}

export function ActionsMenu({
  projectId,
  projectName: _projectName,
  onNewChat,
  isLoading = false,
  isBuildLoading = false,
  disabled = false,
  onFirstInteraction: _onFirstInteraction,
}: ActionsMenuProps) {
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [gitDialogOpen, setGitDialogOpen] = useState(false);

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
            onClick={() => setGitDialogOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <GitBranch className="h-4 w-4" />
            Repository
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setGitHistoryOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Rollback
          </DropdownMenuItem>


        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <GitDialog
        projectId={projectId}
        open={gitDialogOpen}
        onOpenChange={setGitDialogOpen}
      />

      <GitHistoryDialog
        projectId={projectId}
        open={gitHistoryOpen}
        onOpenChange={setGitHistoryOpen}
      />


    </>
  );
}