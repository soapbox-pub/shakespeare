import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GitBranch,
  MessageSquarePlus,
  History,
  Folder,
  Rocket,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectTitleMenuProps {
  projectName: string;
  onNewChat: () => void;
  onGitHistory: () => void;
  onGitDialog: () => void;
  onDeploy: () => void;
  onDuplicate: () => void;
  onProjectDetails: () => void;
  isAILoading: boolean;
  isAnyLoading: boolean;
  className?: string;
}

export function ProjectTitleMenu({
  projectName,
  onNewChat,
  onGitHistory,
  onGitDialog,
  onDeploy,
  onDuplicate,
  onProjectDetails,
  isAILoading,
  isAnyLoading,
  className = '',
}: ProjectTitleMenuProps) {
  const { t } = useTranslation();

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
          onClick={onNewChat}
          disabled={isAILoading}
          className="gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
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
          onClick={onGitDialog}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <GitBranch className="h-4 w-4" />
          Repository
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onDeploy}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          Deploy
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
          onClick={onProjectDetails}
          disabled={isAnyLoading}
          className="gap-2"
        >
          <Folder className="h-4 w-4" />
          Project Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
