import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  MessageSquarePlus, 
  Play, 
  CloudUpload, 
  Settings,
  Loader2,
  GitBranch
} from 'lucide-react';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { AISettingsDialog } from '@/components/ai/AISettingsDialog';

interface ActionsMenuProps {
  projectId: string;
  onNewChat: () => void;
  onBuild: () => void;
  onDeploy: () => void;
  isLoading?: boolean;
  isBuildLoading?: boolean;
  isDeployLoading?: boolean;
  disabled?: boolean;
  onFirstInteraction?: () => void;
}

export function ActionsMenu({
  projectId,
  onNewChat,
  onBuild,
  onDeploy,
  isLoading = false,
  isBuildLoading = false,
  isDeployLoading = false,
  disabled = false,
  onFirstInteraction
}: ActionsMenuProps) {
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [aiSettingsOpen, setAISettingsOpen] = useState(false);

  const isAnyLoading = isLoading || isBuildLoading || isDeployLoading;

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
            <GitBranch className="h-4 w-4" />
            Git History
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => {
              if (onFirstInteraction) onFirstInteraction();
              onBuild();
            }}
            disabled={isAnyLoading}
            className="gap-2"
          >
            {isBuildLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isBuildLoading ? 'Building...' : 'Build'}
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => {
              if (onFirstInteraction) onFirstInteraction();
              onDeploy();
            }}
            disabled={isAnyLoading}
            className="gap-2"
          >
            {isDeployLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            {isDeployLoading ? 'Deploying...' : 'Deploy'}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setAISettingsOpen(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            AI Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <GitHistoryDialog
        projectId={projectId}
        open={gitHistoryOpen}
        onOpenChange={setGitHistoryOpen}
      />
      
      <AISettingsDialog
        open={aiSettingsOpen}
        onOpenChange={setAISettingsOpen}
      />
    </>
  );
}