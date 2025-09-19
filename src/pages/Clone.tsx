import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, Loader2, AlertCircle } from 'lucide-react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
import { NIP05 } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import type { Project } from '@/lib/ProjectsManager';

import { useSeoMeta } from '@unhead/react';

interface NostrCloneUri {
  pubkey: string;
  dTag: string;
  relay?: string;
}

export default function Clone() {
  const { t } = useTranslation();
  const [repoUrl, setRepoUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const { nostr } = useNostr();

  useSeoMeta({
    title: `${t('importRepository')} - Shakespeare`,
    description: t('cloneGitRepository'),
  });

  const extractRepoName = (url: string): string => {
    try {
      // Handle different URL formats
      const cleanUrl = url.trim();

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

  const parseNostrCloneUri = async (uri: string): Promise<NostrCloneUri | null> => {
    try {
      if (!uri.startsWith('nostr://')) {
        return null;
      }

      const path = uri.slice(8); // Remove 'nostr://' prefix
      const parts = path.split('/');

      if (parts.length < 2) {
        return null;
      }

      const identifier = parts[0];
      let pubkey: string;

      // Try to decode as npub first, otherwise assume it's already a hex pubkey
      try {
        const decoded = nip19.decode(identifier);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          return null;
        }
      } catch {
        // If decoding fails, check if it's a NIP-05 identifier
        if (identifier.split('@').length === 2) {
          const pointer = await NIP05.lookup(identifier, {
            signal: AbortSignal.timeout(3000),
          });
          pubkey = pointer.pubkey;
        } else {
          return null;
        }
      }

      // Check if we have relay and d-tag or just d-tag
      if (parts.length === 3) {
        // Format: nostr://npub/relay/dtag
        return {
          pubkey,
          relay: parts[1],
          dTag: parts[2],
        };
      } else if (parts.length === 2) {
        // Format: nostr://npub/dtag
        return {
          pubkey,
          dTag: parts[1],
        };
      }

      return null;
    } catch {
      return null;
    }
  };

  const validateGitUrl = useCallback((url: string): boolean => {
    if (!url.trim()) return false;

    // Check if it's a Nostr clone URI
    if (url.startsWith('nostr://')) {
      return parseNostrCloneUri(url) !== null;
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

  const fetchNostrRepository = useCallback(async (nostrUri: NostrCloneUri): Promise<string[]> => {
    const signal = AbortSignal.timeout(10000); // 10 second timeout

    // Build the filter for the NIP-34 repository announcement
    const filter = {
      kinds: [30617],
      authors: [nostrUri.pubkey],
      '#d': [nostrUri.dTag],
      limit: 1,
    };

    // Use a specific relay if provided
    const client = nostrUri.relay
      ? nostr.relay(nostrUri.relay)
      : nostr.group(['wss://relay.ngit.dev/', 'wss://gitnostr.com/']);

    // Query for the repository announcement event
    const events = await client.query([filter], { signal });

    if (events.length === 0) {
      throw new Error('Repository not found on Nostr network');
    }

    const repoEvent = events[0];

    // Extract clone URLs from the event tags
    const cloneUrls: string[] = [];
    for (const tag of repoEvent.tags) {
      if (tag[0] === 'clone' && tag[1]) {
        cloneUrls.push(tag[1]);
      }
    }

    if (cloneUrls.length === 0) {
      throw new Error('No clone URLs found in repository announcement');
    }

    return cloneUrls;
  }, [nostr]);

  const tryCloneUrls = useCallback(async (cloneUrls: string[], repoName: string): Promise<Project> => {
    let lastError: Error | null = null;

    for (const cloneUrl of cloneUrls) {
      try {
        console.log(`Attempting to clone from: ${cloneUrl}`);

        // Try cloning with a timeout
        const project = await Promise.race([
          projectsManager.cloneProject(repoName, cloneUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Clone timeout')), 30000)
          )
        ]);

        return project; // Success!
      } catch (error) {
        console.warn(`Failed to clone from ${cloneUrl}:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        continue; // Try the next URL
      }
    }

    // If we get here, all clone attempts failed
    throw lastError || new Error('All clone attempts failed');
  }, [projectsManager]);

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

      // Check if it's a Nostr clone URI
      const nostrUri = await parseNostrCloneUri(targetUrl.trim());

      if (nostrUri) {
        // Handle Nostr clone URI
        console.log('Parsing Nostr clone URI:', nostrUri);

        // Fetch the repository announcement from Nostr
        const cloneUrls = await fetchNostrRepository(nostrUri);
        console.log('Found clone URLs:', cloneUrls);

        // Extract repository name from d-tag
        const repoName = nostrUri.dTag;

        // Try cloning from each URL in order
        const project = await tryCloneUrls(cloneUrls, repoName);

        toast({
          title: t('nostrRepositoryImportedSuccessfully'),
          description: t('repositoryClonedFromNostr', { repoName }),
        });

        // Navigate to the new project
        navigate(`/project/${project.id}`);
      } else {
        // Handle regular Git URL
        const repoName = extractRepoName(targetUrl);
        const project = await projectsManager.cloneProject(repoName, targetUrl.trim());

        toast({
          title: t('repositoryImportedSuccessfully'),
          description: t('repositoryClonedReady', { repoName }),
        });

        // Navigate to the new project
        navigate(`/project/${project.id}`);
      }
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
  }, [fetchNostrRepository, navigate, projectsManager, repoUrl, t, toast, tryCloneUrls, validateGitUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCloning) {
      handleClone();
    }
  };

  // Initialize repoUrl from URL parameters and auto-import if URL is provided
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      const decodedUrl = decodeURIComponent(urlParam);
      setRepoUrl(decodedUrl);

      // Automatically start the clone process with the URL directly
      handleClone(decodedUrl);
    }
  }, [handleClone, searchParams]);

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
      </div>
    </AppLayout>
  );
}