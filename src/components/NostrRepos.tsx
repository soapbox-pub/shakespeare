import { useState } from 'react';
import { useNostrRepos, type NostrRepo } from '@/hooks/useNostrRepos';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GitBranch, Download, ExternalLink, Users, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nip19 } from 'nostr-tools';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

interface NostrReposProps {
  className?: string;
  excludeProjectIds?: string[]; // Project IDs that are already "nostr enabled"
  onProjectCloned?: () => void; // Callback when a project is successfully cloned
}

export function NostrRepos({ className, excludeProjectIds = [], onProjectCloned }: NostrReposProps) {
  const { data: repos, isLoading, error } = useNostrRepos();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const [cloningRepos, setCloningRepos] = useState<Set<string>>(new Set());

  // Filter out repos that are already represented as projects
  const availableRepos = repos?.filter(repo => !excludeProjectIds.includes(repo.id)) || [];

  const handleCloneRepo = async (repo: NostrRepo) => {
    if (!repo.cloneUrls.length) {
      toast({
        title: "No clone URL",
        description: "This repository doesn't have any clone URLs configured.",
        variant: "destructive",
      });
      return;
    }

    setCloningRepos(prev => new Set(prev).add(repo.id));

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
        pubkey: repo.event.pubkey,
        kind: 30617,
        relays: repo.relays.length > 0 ? repo.relays : undefined,
      });

      await git.setConfig({
        fs: projectsManager.fs,
        dir: projectPath,
        path: 'nostr.repo',
        value: naddr,
      });

      // Create project metadata
      const now = new Date();
      const metadata = {
        name: repo.name,
        createdAt: now.toISOString(),
        lastModified: now.toISOString(),
      };

      // Save project metadata in .git directory
      const gitDir = `${projectPath}/.git`;
      await projectsManager.fs.writeFile(
        `${gitDir}/project.json`,
        JSON.stringify(metadata, null, 2)
      );

      toast({
        title: "Repository cloned",
        description: `${repo.name} has been cloned to your projects.`,
      });

      // Call the callback to refresh the projects list, or fall back to page reload
      if (onProjectCloned) {
        onProjectCloned();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to clone repository:', error);
      toast({
        title: "Clone failed",
        description: `Failed to clone ${repo.name}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setCloningRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(repo.id);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h2 className="text-xl md:text-2xl font-semibold">Your Nostr Repositories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("space-y-4", className)}>
        <h2 className="text-xl md:text-2xl font-semibold">Your Nostr Repositories</h2>
        <Card className="border-destructive/20">
          <CardContent className="py-6 text-center">
            <p className="text-destructive">Failed to load repositories</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!availableRepos.length) {
    return null; // Don't show the section if there are no repos to display
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-xl md:text-2xl font-semibold">Your Nostr Repositories</h2>
      <p className="text-muted-foreground text-sm">
        Clone your NIP-34 repositories to start working on them locally.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableRepos.map((repo) => {
          const isCloning = cloningRepos.has(repo.id);

          return (
            <Card
              key={repo.id}
              className="bg-gradient-to-br from-card to-card/80 border-primary/10 hover:border-primary/20 transition-all duration-300"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base md:text-lg flex items-center gap-2 truncate">
                      <GitBranch className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="truncate">{repo.name}</span>
                    </CardTitle>
                    {repo.description && (
                      <CardDescription className="text-sm mt-1 line-clamp-2">
                        {repo.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
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

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleCloneRepo(repo)}
                    disabled={isCloning || !repo.cloneUrls.length}
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}