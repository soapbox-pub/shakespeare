import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  GitBranch,
  Download,
  ExternalLink,
  Users,
  Globe,
  Cloud,
  HardDrive,
  RefreshCw,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { nip19 } from 'nostr-tools';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import type { UnifiedRepo } from '@/hooks/useRepos';

interface RepoCardProps {
  repo: UnifiedRepo;
  onRepoCloned?: () => void;
  className?: string;
}

export function RepoCard({ repo, onRepoCloned, className }: RepoCardProps) {
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const [isCloning, setIsCloning] = useState(false);

  const getStatusIcon = () => {
    switch (repo.status) {
      case 'local-only':
        return <HardDrive className="h-4 w-4 text-blue-500" />;
      case 'published':
        return <Upload className="h-4 w-4 text-green-500" />;
      case 'remote-only':
        return <Cloud className="h-4 w-4 text-orange-500" />;
      case 'synced':
        return <RefreshCw className="h-4 w-4 text-emerald-500" />;
    }
  };

  const getStatusText = () => {
    switch (repo.status) {
      case 'local-only':
        return 'Local only';
      case 'published':
        return 'Published';
      case 'remote-only':
        return 'Remote only';
      case 'synced':
        return 'Synced';
    }
  };

  const getStatusColor = () => {
    switch (repo.status) {
      case 'local-only':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'remote-only':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'synced':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    }
  };

  const handleCardClick = () => {
    if (repo.localProject) {
      navigate(`/project/${repo.localProject.id}`);
    }
  };

  const handleCloneRepo = async () => {
    if (!repo.nostrRepo || !repo.cloneUrls.length) {
      toast({
        title: "No clone URL",
        description: "This repository doesn't have any clone URLs configured.",
        variant: "destructive",
      });
      return;
    }

    setIsCloning(true);

    try {
      await projectsManager.init();

      // Create project directory
      const projectPath = `/projects/${repo.id}`;

      // Clone the repository
      const cloneUrl = repo.cloneUrls[0]; // Use the first clone URL
      await git.clone({
        fs: projectsManager.fs,
        http,
        dir: projectPath,
        url: cloneUrl,
        singleBranch: true,
        depth: 1,
      });

      // Set git config to mark this as a nostr-enabled project
      const naddr = nip19.naddrEncode({
        identifier: repo.id,
        pubkey: repo.nostrRepo.event.pubkey,
        kind: 30617,
        relays: repo.relays.length > 0 ? repo.relays : undefined,
      });

      await git.setConfig({
        fs: projectsManager.fs,
        dir: projectPath,
        path: 'nostr.repo',
        value: naddr,
      });

      toast({
        title: "Repository cloned",
        description: `${repo.name} has been cloned to your projects.`,
      });

      // Call the callback to refresh the repos list
      if (onRepoCloned) {
        onRepoCloned();
      }
    } catch (error) {
      console.error('Failed to clone repository:', error);
      toast({
        title: "Clone failed",
        description: `Failed to clone ${repo.name}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const canOpen = repo.status === 'local-only' || repo.status === 'published' || repo.status === 'synced';
  const canClone = repo.status === 'remote-only' && repo.cloneUrls.length > 0;

  return (
    <Card
      className={cn(
        "transition-all duration-300 bg-gradient-to-br from-card to-card/80 border-primary/10 hover:border-primary/20",
        canOpen && "cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:scale-[1.02]",
        className
      )}
      onClick={canOpen ? handleCardClick : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={canOpen ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      } : undefined}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base md:text-lg flex items-center gap-2 truncate">
              {repo.status === 'remote-only' ? (
                <GitBranch className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 text-primary flex-shrink-0" />
              )}
              <span className="truncate">{repo.name}</span>
            </CardTitle>
            {repo.description && (
              <CardDescription className="text-sm mt-1 line-clamp-2">
                {repo.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge variant="outline" className={cn("text-xs", getStatusColor())}>
              <span className="flex items-center gap-1">
                {getStatusIcon()}
                {getStatusText()}
              </span>
            </Badge>
          </div>
        </div>
        <CardDescription className="text-sm">
          Modified {repo.lastModified.toLocaleDateString()}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Tags */}
        {repo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {repo.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {repo.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{repo.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Repository info */}
        {(repo.maintainers.length > 0 || repo.webUrls.length > 0) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {repo.maintainers.length > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{repo.maintainers.length} maintainer{repo.maintainers.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            {repo.webUrls.length > 0 && (
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>Web</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {(canClone || repo.webUrls.length > 0) && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {canClone && (
              <Button
                onClick={handleCloneRepo}
                disabled={isCloning}
                className="flex-1"
                size="sm"
              >
                {isCloning ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Cloning...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3 mr-2" />
                    Clone
                  </>
                )}
              </Button>
            )}

            {repo.webUrls.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(repo.webUrls[0], '_blank')}
                className="px-3"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}