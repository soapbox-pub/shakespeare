import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { GitBranch, Loader2, AlertCircle } from 'lucide-react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';
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
  const [repoUrl, setRepoUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();
  const { nostr } = useNostr();

  useSeoMeta({
    title: 'Import Repository - Shakespeare',
    description: 'Import a Git repository into your Shakespeare workspace',
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

  const parseNostrCloneUri = (uri: string): NostrCloneUri | null => {
    try {
      if (!uri.startsWith('nostr://')) {
        return null;
      }

      const path = uri.slice(8); // Remove 'nostr://' prefix
      const parts = path.split('/');

      if (parts.length < 2) {
        return null;
      }

      const npubOrPubkey = parts[0];
      let pubkey: string;

      // Try to decode as npub first, otherwise assume it's already a hex pubkey
      try {
        const decoded = nip19.decode(npubOrPubkey);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          return null;
        }
      } catch {
        // If decoding fails, check if it's a valid hex pubkey
        if (/^[a-f0-9]{64}$/i.test(npubOrPubkey)) {
          pubkey = npubOrPubkey;
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

  const validateGitUrl = (url: string): boolean => {
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
  };

  const fetchNostrRepository = async (nostrUri: NostrCloneUri): Promise<string[]> => {
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
      : nostr;

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
  };

  const tryCloneUrls = async (cloneUrls: string[], repoName: string): Promise<Project> => {
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
  };

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    if (!validateGitUrl(repoUrl)) {
      setError('Please enter a valid Git repository URL or Nostr clone URI (e.g., nostr://npub.../repo-name)');
      return;
    }

    setIsCloning(true);
    setError(null);

    try {
      await projectsManager.init();

      // Check if it's a Nostr clone URI
      const nostrUri = parseNostrCloneUri(repoUrl.trim());

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
          title: "Nostr repository imported successfully",
          description: `"${repoName}" has been cloned from Nostr and is ready for development.`,
        });

        // Navigate to the new project
        navigate(`/project/${project.id}`);
      } else {
        // Handle regular Git URL
        const repoName = extractRepoName(repoUrl);
        const project = await projectsManager.cloneProject(repoName, repoUrl.trim());

        toast({
          title: "Repository imported successfully",
          description: `"${repoName}" has been cloned and is ready for development.`,
        });

        // Navigate to the new project
        navigate(`/project/${project.id}`);
      }
    } catch (error) {
      console.error('Failed to clone repository:', error);

      let errorMessage = 'Failed to clone repository';
      if (error instanceof Error) {
        if (error.message.includes('Repository not found on Nostr network')) {
          errorMessage = 'Repository not found on Nostr network. Please check the URI and try again.';
        } else if (error.message.includes('No clone URLs found')) {
          errorMessage = 'Repository announcement found but no clone URLs available.';
        } else if (error.message.includes('All clone attempts failed')) {
          errorMessage = 'Repository found but all clone URLs failed. The repository may be unavailable.';
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          errorMessage = 'Repository not found. Please check the URL and try again.';
        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
          errorMessage = 'Access denied. The repository may be private or require authentication.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);

      toast({
        title: "Failed to import repository",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCloning) {
      handleClone();
    }
  };

  return (
    <AppLayout title="Import Repository">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">
            <GitBranch className="h-12 w-12 mx-auto text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Import Repository
          </h1>
          <p className="text-lg text-muted-foreground">
            Clone a Git repository into your Shakespeare workspace
          </p>
        </div>

        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Repository URL</CardTitle>
            <CardDescription className="text-base">
              Enter a Git repository URL or Nostr clone URI to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url">Repository URL</Label>
              <Input
                id="repo-url"
                type="text"
                placeholder="https://github.com/username/repository.git or nostr://npub.../repo-name"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setError(null); // Clear error when user types
                }}
                onKeyDown={handleKeyDown}
                disabled={isCloning}
                className="text-base"
              />
              <p className="text-sm text-muted-foreground">
                Supports Git URLs and Nostr clone URIs (nostr://npub.../repo-name)
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              onClick={handleClone}
              disabled={!repoUrl.trim() || isCloning}
              className="w-full focus-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
              size="lg"
            >
              {isCloning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cloning Repository...
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Import Repository
                </>
              )}
            </Button>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">Supported Repository Types</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Public GitHub repositories</li>
                <li>• Public GitLab repositories</li>
                <li>• Any public Git repository accessible via HTTPS</li>
                <li>• Nostr repositories via NIP-34 clone URIs</li>
              </ul>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">
                  Nostr Clone URI Examples:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-2">
                  <li>• <code>nostr://npub1.../repo-name</code></li>
                  <li>• <code>nostr://npub1.../relay.example.com/repo-name</code></li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Note: Private repositories requiring authentication are not currently supported.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}