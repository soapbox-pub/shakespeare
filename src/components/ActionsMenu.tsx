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
  Folder,
  Rocket,
  Trash2,
} from 'lucide-react';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { GitDialog } from '@/components/GitDialog';
import { DeployDialog } from '@/components/DeployDialog';
import { DeleteChatDialog } from '@/components/DeleteChatDialog';

interface ActionsMenuProps {
  projectId: string;
  projectName: string;
  onNewChat: () => void;
  onProjectDetails?: () => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  disabled?: boolean;
  onFirstInteraction?: () => void;
  isChat?: boolean; // Flag to indicate this is a chat, not a project
  onChatDeleted?: () => void; // Callback when a chat is deleted
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
  isChat = false,
  onChatDeleted,
}: ActionsMenuProps) {
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [gitDialogOpen, setGitDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deleteChatOpen, setDeleteChatOpen] = useState(false);

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
          {isChat ? (
            <DropdownMenuItem
              onClick={() => setDeleteChatOpen(true)}
              disabled={isLoading}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Chat
            </DropdownMenuItem>
          ) : (
            <>
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
                onClick={() => setGitDialogOpen(true)}
                disabled={isAnyLoading}
                className="gap-2"
              >
                <GitBranch className="h-4 w-4" />
                Repository
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
                onClick={onProjectDetails}
                disabled={isAnyLoading}
                className="gap-2"
              >
                <Folder className="h-4 w-4" />
                Project Details
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs - only show for projects, not chats */}
      {!isChat && (
        <>
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

          <DeployDialog
            projectId={projectId}
            projectName={projectName}
            open={deployDialogOpen}
            onOpenChange={setDeployDialogOpen}
          />
        </>
      )}

      {/* Delete Chat Dialog - only show for chats */}
      {isChat && (
        <DeleteChatDialog
          chatId={projectId}
          chatName={projectName}
          open={deleteChatOpen}
          onOpenChange={setDeleteChatOpen}
          onDeleted={onChatDeleted}
        />
      )}
    </>
  );
}