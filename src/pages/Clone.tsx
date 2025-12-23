import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, Loader2, AlertCircle, FileArchive, MoreHorizontal, Search } from 'lucide-react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { ZipImportDialog } from '@/components/ZipImportDialog';
import { useSeoMeta } from '@unhead/react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRepositories } from '@/hooks/useUserRepositories';
import { useContacts } from '@/hooks/useContacts';
import { useFollowedRepositories } from '@/hooks/useFollowedRepositories';
import { RepositoryCard } from '@/components/RepositoryCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Repository } from '@/hooks/useUserRepositories';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { NSchema as n } from '@nostrify/nostrify';
import type { NostrMetadata } from '@nostrify/nostrify';
import { NostrURI } from '@/lib/NostrURI';
import { useGitSettings } from '@/hooks/useGitSettings';
import { findCredentialsForRepo } from '@/lib/gitCredentials';

export default function Clone() {
  const { t } = useTranslation();
  const [repoUrl, setRepoUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const autoCloneInitiatedRef = useRef(false);
  const [isZipDialogOpen, setIsZipDialogOpen] = useState(false);
  const { user } = useCurrentUser();
  const { settings: gitSettings } = useGitSettings();
  const { data: repositories = [], isLoading: isLoadingRepos } = useUserRepositories(user?.pubkey);
  const { data: contacts = [] } = useContacts(user?.pubkey);
  const { data: followedRepositories = [], isLoading: isLoadingFollowedRepos } = useFollowedRepositories(contacts);
  const [activeTab, setActiveTab] = useState<'my-projects' | 'follows'>('my-projects');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique pubkeys from all repositories
  const allRepos = useMemo(() => [...repositories, ...followedRepositories], [repositories, followedRepositories]);
  const uniquePubkeys = useMemo(() => {
    const pubkeys = new Set<string>();
    allRepos.forEach(repo => pubkeys.add(repo.pubkey));
    return Array.from(pubkeys);
  }, [allRepos]);

  // Fetch author metadata for all unique pubkeys
  const { nostr } = useNostr();
  const { data: authorMetadataMap = new Map<string, NostrMetadata>() } = useQuery({
    queryKey: ['repository-authors', uniquePubkeys.sort().join(',')],
    queryFn: async () => {
      if (uniquePubkeys.length === 0) return new Map<string, NostrMetadata>();

      const events = await nostr.query(
        [{ kinds: [0], authors: uniquePubkeys, limit: uniquePubkeys.length }],
        { signal: AbortSignal.timeout(3000) }
      );

      const metadataMap = new Map<string, NostrMetadata>();
      for (const event of events) {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          metadataMap.set(event.pubkey, metadata);
        } catch {
          // If parsing fails, continue without metadata for this pubkey
        }
      }
      return metadataMap;
    },
    enabled: uniquePubkeys.length > 0,
    staleTime: 60000, // 1 minute
  });

  useSeoMeta({
    title: `${t('importRepository')} - Shakespeare`,
    description: t('cloneGitRepository'),
  });

  const extractRepoName = async (url: string): Promise<string> => {
    try {
      const cleanUrl = url.trim();

      // Handle Nostr clone URIs
      if (cleanUrl.startsWith('nostr://')) {
        try {
          const nostrURI = await NostrURI.parse(cleanUrl);
          return nostrURI.identifier || 'nostr-repo';
        } catch {
          return 'nostr-repo';
        }
      }

      // Extract from GitHub URLs, GitLab URLs, etc.
      const match = cleanUrl.match(/\/([^/]+?)(?:\.git)?(?:\/)?$/);
      if (match && match[1]) {
        return match[1];
      }

      // Fallback: use the last part of the URL
      const parts = cleanUrl.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      return lastPart.replace('.git', '') || 'imported-repo';
    } catch {
      return 'imported-repo';
    }
  };

  const validateGitUrl = useCallback((url: string): boolean => {
    if (!url.trim()) return false;

    // Check if it's a Nostr clone URI
    if (url.startsWith('nostr://')) {
      return true; // Git class will handle validation
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return false;
    }

    // Check if it looks like a git repository URL
    const gitUrlPattern = /^https?:\/\/.*\.git$|^https?:\/\/github\.com\/.*\/.*$|^https?:\/\/gitlab\.com\/.*\/.*$/i;
    return gitUrlPattern.test(url) || url.includes('github.com') || url.includes('gitlab.com');
  }, []);

  const handleClone = useCallback(async (url?: string) => {
    const targetUrl = url || repoUrl;

    if (!targetUrl.trim()) {
      setError(t('pleaseEnterRepositoryUrl'));
      return;
    }

    if (!validateGitUrl(targetUrl)) {
      setError(t('pleaseEnterValidGitUrl'));
      return;
    }

    setIsCloning(true);
    setError(null);

    try {
      await projectsManager.init();

      // Extract repository name
      const repoName = await extractRepoName(targetUrl);

      // Determine if this is a fork
      let fork = false;

      if (targetUrl.startsWith('nostr://') && user) {
        // For Nostr URIs: check if the repository owner is different from current user
        try {
          const nostrURI = await NostrURI.parse(targetUrl);
          fork = nostrURI.pubkey !== user.pubkey;
        } catch {
          // If parsing fails, default to fork=false
        }
      } else if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        // For HTTPS URLs: check if the URL belongs to the user based on credentials
        // A repository is NOT a fork if it starts with ${credential.origin}/${credential.username}/
        const credential = findCredentialsForRepo(targetUrl, gitSettings.credentials);

        if (credential) {
          const expectedPrefix = `${credential.origin}/${credential.username}/`;
          fork = !targetUrl.startsWith(expectedPrefix);
        } else {
          // No matching credentials found, treat as fork
          fork = true;
        }
      }

      // Clone the repository (Git class handles both regular Git URLs and Nostr URIs)
      const project = await projectsManager.cloneProject({
        name: repoName,
        repoUrl: targetUrl.trim(),
        fork,
      });

      // Determine success message based on URL type
      const isNostrUri = targetUrl.startsWith('nostr://');
      const successTitle = isNostrUri
        ? t('nostrRepositoryImportedSuccessfully')
        : t('repositoryImportedSuccessfully');
      const successDescription = isNostrUri
        ? t('repositoryClonedFromNostr', { repoName })
        : t('repositoryClonedReady', { repoName });

      toast({
        title: successTitle,
        description: successDescription,
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
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          errorMessage = t('repositoryNotFound');
        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
          errorMessage = t('accessDenied');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = t('networkError');
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);

      toast({
        title: t('failedToImportRepository'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  }, [navigate, projectsManager, repoUrl, t, toast, validateGitUrl, user, gitSettings.credentials]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCloning) {
      handleClone();
    }
  };

  // Initialize repoUrl from URL parameters and auto-import if URL is provided
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam && !autoCloneInitiatedRef.current) {
      const decodedUrl = decodeURIComponent(urlParam);
      setRepoUrl(decodedUrl);
      autoCloneInitiatedRef.current = true;

      // Automatically start the clone process with the URL directly
      handleClone(decodedUrl);
    }
  }, [handleClone, searchParams]);

  const handleImportZip = async (file: File, overwrite = false, projectId?: string) => {
    try {
      // Import project from zip file
      const project = await projectsManager.importProjectFromZip(file, projectId, overwrite);

      // Show success toast
      toast({
        title: overwrite ? "Project Overwritten Successfully" : "Project Imported Successfully",
        description: `"${project.name}" has been ${overwrite ? 'overwritten' : 'imported'} and is ready to use.`,
      });

      // Navigate to the imported project
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error('Failed to import project:', error);
      throw error; // Re-throw to let the dialog handle the error display
    }
  };

  // Filter repositories based on search query
  const filterRepositories = useCallback((repos: Repository[], query: string): Repository[] => {
    if (!query.trim()) {
      return repos;
    }

    const lowerQuery = query.toLowerCase();

    return repos.filter((repo) => {
      // Filter by repository name
      if (repo.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Filter by description
      if (repo.description?.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Filter by tags (hashtags)
      if (repo.repoTags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      // Filter by hex pubkey
      if (repo.pubkey.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Filter by npub (bech32 encoded pubkey)
      try {
        const npub = nip19.npubEncode(repo.pubkey);
        if (npub.toLowerCase().includes(lowerQuery)) {
          return true;
        }
      } catch {
        // If encoding fails, skip npub search
      }

      // Filter by author name
      const authorMetadata = authorMetadataMap.get(repo.pubkey);
      if (authorMetadata?.name?.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });
  }, [authorMetadataMap]);

  // Filtered repositories for "My Projects" tab
  const filteredMyRepositories = useMemo(() => {
    return filterRepositories(repositories, searchQuery);
  }, [repositories, searchQuery, filterRepositories]);

  // Filtered repositories for "Follows" tab
  const filteredFollowedRepositories = useMemo(() => {
    return filterRepositories(followedRepositories, searchQuery);
  }, [followedRepositories, searchQuery, filterRepositories]);

  return (
    <AppLayout title={t('importRepository')}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">
            <GitBranch className="h-12 w-12 mx-auto text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t('importRepository')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('cloneGitRepository')}
          </p>
        </div>

        <div className="space-y-2">
          <Input
            id="repo-url"
            type="text"
            placeholder="https://github.com/username/repository.git"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              setError(null); // Clear error when user types
            }}
            onKeyDown={handleKeyDown}
            disabled={isCloning}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            onClick={() => handleClone()}
            disabled={!repoUrl.trim() || isCloning}
            className="w-full focus-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
            size="lg"
          >
            {isCloning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('cloningRepository')}
              </>
            ) : (
              <>
                <GitBranch className="mr-2 h-4 w-4" />
                {t('importRepository')}
              </>
            )}
          </Button>
        </div>

        {/* Import ZIP File Link */}
        <div className="mt-8 text-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-transparent">
                <MoreHorizontal className="h-5 w-5" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem
                className="flex items-center gap-2 w-full"
                onClick={() => setIsZipDialogOpen(true)}
              >
                <FileArchive className="h-4 w-4" />
                Import ZIP File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ZIP Import Dialog */}
      <ZipImportDialog
        onImport={handleImportZip}
        open={isZipDialogOpen}
        onOpenChange={setIsZipDialogOpen}
      />

      {/* NIP-34 Repositories with Tabs */}
      {user && (
        <div className="mt-16 max-w-7xl mx-auto">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my-projects' | 'follows')}>
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <TabsList>
                <TabsTrigger value="my-projects">
                  My Projects
                </TabsTrigger>
                <TabsTrigger value="follows">
                  Follows
                </TabsTrigger>
              </TabsList>

              {/* Search Input */}
              {(repositories.length > 0 || followedRepositories.length > 0) && (
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              )}
            </div>

            <TabsContent value="my-projects">
              {isLoadingRepos ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="h-full flex flex-col">
                      <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex items-start gap-3 mb-4">
                          <Skeleton className="w-12 h-12 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </div>
                        <div className="space-y-2 mb-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-4/5" />
                        </div>
                        <div className="flex gap-1 mb-4">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <div className="mt-auto flex gap-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 w-9" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredMyRepositories.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMyRepositories.map((repo) => (
                    <RepositoryCard key={repo.id} repo={repo} />
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 px-8 text-center">
                    <div className="max-w-sm mx-auto space-y-4">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No repositories found matching "{searchQuery}".
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12 px-8 text-center">
                    <div className="max-w-sm mx-auto space-y-4">
                      <p className="text-muted-foreground">
                        No repositories found. Publish your first repository to Nostr to see it here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="follows">
              {isLoadingFollowedRepos ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="h-full flex flex-col">
                      <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex items-start gap-3 mb-4">
                          <Skeleton className="w-12 h-12 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </div>
                        <div className="space-y-2 mb-4">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-4/5" />
                        </div>
                        <div className="flex gap-1 mb-4">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <div className="mt-auto flex gap-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 w-9" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredFollowedRepositories.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFollowedRepositories.map((repo) => (
                    <RepositoryCard key={repo.id} repo={repo} />
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 px-8 text-center">
                    <div className="max-w-sm mx-auto space-y-4">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No repositories found matching "{searchQuery}".
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : contacts.length > 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 px-8 text-center">
                    <div className="max-w-sm mx-auto space-y-4">
                      <p className="text-muted-foreground">
                        None of the people you follow have published repositories yet.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12 px-8 text-center">
                    <div className="max-w-sm mx-auto space-y-4">
                      <p className="text-muted-foreground">
                        You're not following anyone yet. Follow people on Nostr to see their repositories here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppLayout>
  );
}