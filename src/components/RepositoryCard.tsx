import React, { useState, useRef, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Loader2, EllipsisVertical, Edit, Code, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useOGImage } from '@/hooks/useOGImage';
import { ZapDialog } from '@/components/ZapDialog';
import { Zap } from 'lucide-react';
import type { Event } from 'nostr-tools';
import type { NostrMetadata } from '@nostrify/nostrify';
import { formatRelativeTime } from '@/lib/utils';

interface RepositoryCardProps {
  repo: Repository;
  /** Pre-fetched author metadata to avoid individual fetches */
  authorMetadata?: NostrMetadata;
  /** Callback when a tag is clicked - receives the tag value */
  onTagClick?: (tag: string) => void;
}

function RepositoryCardInner({ repo, authorMetadata: preloadedMetadata, onTagClick }: RepositoryCardProps) {
  // Only fetch author data if not preloaded
  const { data: authorData } = useAuthor(preloadedMetadata ? undefined : repo.pubkey);
  const metadata = preloadedMetadata ?? authorData?.metadata;
  
  const { user } = useCurrentUser();
  const { settings: gitSettings } = useGitSettings();
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCloning, setIsCloning] = useState(false);
  const [editRepoOpen, setEditRepoOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [eventViewerOpen, setEventViewerOpen] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Lazy load OG images - only fetch when card is in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading slightly before visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const displayName = metadata?.name || genUserName(repo.pubkey);
  const profileImage = metadata?.picture;
  const isOwnRepo = user?.pubkey === repo.pubkey;
  const hasLightning = !!(metadata?.lud16 || metadata?.lud06);
  const canZap = user && !isOwnRepo && hasLightning;

  // Get OG metadata from first web URL - only when in viewport
  const firstWebUrl = repo.webUrls?.[0];
  const { data: ogMetadata } = useOGImage(isInViewport ? firstWebUrl : undefined);
  const ogImageUrl = ogMetadata?.image ?? null;
  const ogDescription = ogMetadata?.description ?? null;

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

  // Check if we have a valid OG image to show
  const hasValidImage = ogImageUrl && !imageError;

  return (
    <Card ref={cardRef} className="h-full flex flex-col hover:shadow-lg transition-shadow">
      {/* Preview Image or Placeholder */}
      {hasValidImage && firstWebUrl ? (
        <a
          href={firstWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video bg-muted overflow-hidden rounded-t-lg cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src={ogImageUrl}
            alt={`${repo.name} preview`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </a>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-primary to-accent rounded-t-lg flex items-center justify-center">
          <Code className="h-12 w-12 text-white" />
        </div>
      )}
      <CardContent className="p-6 flex flex-col flex-1">
        {/* Header with name and menu */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-end gap-2 mb-2">
              <h3 className="font-semibold text-lg leading-tight truncate">
                {repo.name}
              </h3>
              <span className="text-sm text-muted-foreground shrink-0">
                {formatRelativeTime(repo.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center -mt-1 -mr-2 shrink-0">
            {canZap && (
              <ZapDialog target={repo as unknown as Event}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10">
                  <Zap className="h-4 w-4" />
                </Button>
              </ZapDialog>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {firstWebUrl && (
                <DropdownMenuItem asChild className="gap-2">
                  <a href={firstWebUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open Website
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setEventViewerOpen(true)} className="gap-2">
                <Code className="h-4 w-4" />
                View Event
              </DropdownMenuItem>
              {isOwnRepo && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditRepoOpen(true)} className="gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Repository
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Author */}
        <div className="mb-4">
          <div className="flex items-center gap-3 text-sm">
            <Avatar className="h-10 w-10">
              {profileImage && (
                <AvatarImage src={profileImage} alt={displayName} />
              )}
              <AvatarFallback className="text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(displayName);
                }}
                className="truncate font-medium text-base text-foreground hover:text-primary hover:underline transition-colors text-left"
              >
                {displayName}
              </button>
              {metadata?.nip05 && (
                <span className="text-sm text-muted-foreground shrink-0">{metadata.nip05}</span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {(repo.description || ogDescription) && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {repo.description || ogDescription}
          </p>
        )}

        {/* Tags */}
        {repo.repoTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {repo.repoTags.slice(0, 3).map((tag, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors font-medium"
              >
                #{tag}
              </button>
            ))}
            {repo.repoTags.length > 3 && (
              <span className="text-sm text-muted-foreground">
                +{repo.repoTags.length - 3}
              </span>
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

      {/* Event Viewer Dialog */}
      <Dialog open={eventViewerOpen} onOpenChange={setEventViewerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Repository Event</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            <pre className="text-xs p-4 rounded-lg overflow-x-auto">
              {JSON.stringify({
                id: repo.id,
                pubkey: repo.pubkey,
                created_at: repo.created_at,
                kind: repo.kind,
                tags: repo.tags,
                content: repo.content,
                sig: repo.sig,
              }, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Memoize to prevent re-renders when parent re-renders with same props
export const RepositoryCard = memo(RepositoryCardInner);
