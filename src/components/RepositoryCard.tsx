import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Loader2, EllipsisVertical, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Repository } from '@/hooks/useUserRepositories';
import { useAuthor } from '@/hooks/useAuthor';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import { useNavigate } from 'react-router-dom';
import { NostrURI } from '@/lib/NostrURI';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGitSettings } from '@/hooks/useGitSettings';
import { detectFork } from '@/lib/detectFork';
import { NostrRepoEditDialog } from '@/components/NostrRepoEditDialog';
import { useQueryClient } from '@tanstack/react-query';

interface RepositoryCardProps {
  repo: Repository;
}

export function RepositoryCard({ repo }: RepositoryCardProps) {
  const { data: authorData } = useAuthor(repo.pubkey);
  const { user } = useCurrentUser();
  const { settings: gitSettings } = useGitSettings();
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCloning, setIsCloning] = useState(false);
  const [editRepoOpen, setEditRepoOpen] = useState(false);

  const displayName = authorData?.metadata?.name || genUserName(repo.pubkey);
  const profileImage = authorData?.metadata?.picture;
  const isOwnRepo = user?.pubkey === repo.pubkey;

  // Construct Nostr clone URL
  const nostrURI = new NostrURI({
    pubkey: repo.pubkey,
    identifier: repo.repoId,
    relay: repo.relays[0],
  });

  const handleClone = async (e: React.MouseEvent) => {
    // Prevent card click from triggering
    e.stopPropagation();

    setIsCloning(true);

    try {
      await projectsManager.init();

      // Determine if this is a fork
      const repoUrl = nostrURI.toString();
      const fork = await detectFork(repoUrl, user?.pubkey, gitSettings.credentials);

      // Clone the repository using the Nostr URI
      const project = await projectsManager.cloneProject({
        name: repo.name,
        repoUrl,
        fork,
      });

      toast({
        title: t('nostrRepositoryImportedSuccessfully'),
        description: t('repositoryClonedFromNostr', { repoName: repo.name }),
      });

      // Navigate to the new project with build parameter
      navigate(`/project/${project.id}?build`);
    } catch (error) {
      console.error('Failed to clone repository:', error);

      let errorMessage = t('failedToImportRepository');
      if (error instanceof Error) {
        if (error.message.includes('Repository not found on Nostr network')) {
          errorMessage = t('repositoryNotFoundOnNostr');
        } else if (error.message.includes('No clone URLs found')) {
          errorMessage = t('noCloneUrlsFound');
        } else if (error.message.includes('All clone attempts failed')) {
          errorMessage = t('allCloneAttemptsFailed');
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: t('failedToImportRepository'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleRepoEditSuccess = () => {
    // Refresh repositories list after successful edit
    queryClient.invalidateQueries({ queryKey: ['nostr', 'user-repositories', user?.pubkey] });
  };

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
      <CardContent className="p-6 flex flex-col flex-1">
        {/* Header with name and menu */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight mb-2 truncate">
              {repo.name}
            </h3>
          </div>
          {isOwnRepo && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 shrink-0">
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditRepoOpen(true)} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Repository
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Author */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-4 w-4">
              {profileImage && (
                <AvatarImage src={profileImage} alt={displayName} />
              )}
              <AvatarFallback className="text-[8px]">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{displayName}</span>
          </div>
        </div>

        {/* Description */}
        {repo.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {repo.description}
          </p>
        )}

        {/* Tags */}
        {repo.repoTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {repo.repoTags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {repo.repoTags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{repo.repoTags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Personal fork badge */}
        {repo.isPersonalFork && (
          <div className="mb-4">
            <Badge variant="outline" className="text-xs">
              Personal Fork
            </Badge>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto">
          <Button
            size="sm"
            className="w-full"
            onClick={handleClone}
            disabled={isCloning}
          >
            {isCloning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cloning...
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 mr-2" />
                Clone
              </>
            )}
          </Button>
        </div>
      </CardContent>

      <NostrRepoEditDialog
        open={editRepoOpen}
        onOpenChange={setEditRepoOpen}
        repoIdentifier={repo.repoId}
        onSuccess={handleRepoEditSuccess}
      />
    </Card>
  );
}
