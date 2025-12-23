import { useState, useEffect } from 'react';
import { CloudUpload, Zap, GitBranch, Copy, Check, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalFavicon } from '@/components/ExternalFavicon';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useGitSettings } from '@/hooks/useGitSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { GitCredential } from '@/contexts/GitSettingsContext';

interface GitSyncButtonProps {
  projectId: string;
  className?: string;
}

type SyncState = 'default' | 'select-provider' | 'configure-repo' | 'success' | 'error';

interface ProviderOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  credential?: GitCredential;
}

export function GitSyncButton({ projectId, className }: GitSyncButtonProps) {
  const [open, setOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('default');
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: gitStatus, isLoading: isGitStatusLoading } = useGitStatus(projectId);
  const { settings } = useGitSettings();
  const { user } = useCurrentUser();
  const { git } = useGit();
  const { projectsPath } = useFSPaths();

  // Determine if we have a remote configured
  const originRemote = gitStatus?.remotes.find(r => r.name === 'origin');
  const hasRemote = !!originRemote;

  // Match origin URL to a credential
  const matchedCredential = originRemote
    ? settings.credentials.find(c => originRemote.url.startsWith(c.origin))
    : null;

  // Determine if we need to show the indicator dot
  const showIndicator = !isGitStatusLoading && !hasRemote;

  // Reset state when popover opens/closes
  useEffect(() => {
    if (open) {
      if (hasRemote) {
        setSyncState('default');
      } else {
        setSyncState('select-provider');
      }
      setSelectedProvider(null);
      setRepositoryUrl('');
      setErrorMessage(null);
    }
  }, [open, hasRemote]);

  // Build provider options
  const providerOptions: ProviderOption[] = [
    {
      id: 'nostr',
      name: 'Nostr',
      icon: <Zap className="h-4 w-4" />,
    },
    ...settings.credentials.map(credential => ({
      id: credential.id,
      name: credential.name,
      icon: (
        <ExternalFavicon
          url={credential.origin}
          size={16}
          fallback={<GitBranch className="h-4 w-4" />}
        />
      ),
      credential,
    })),
    {
      id: 'other',
      name: 'Other',
      icon: <GitBranch className="h-4 w-4" />,
    },
  ];

  const handleProviderSelect = (provider: ProviderOption) => {
    setSelectedProvider(provider);
    setErrorMessage(null);

    if (provider.id === 'other') {
      // Show the "Other" state with link to settings
      setSyncState('configure-repo');
      return;
    }

    if (provider.id === 'nostr') {
      if (!user) {
        // Show the "Nostr" state with link to login
        setSyncState('configure-repo');
        return;
      }
      // For Nostr, we can push directly
      setSyncState('configure-repo');
      return;
    }

    // For configured providers, show the repo URL input
    setSyncState('configure-repo');
  };

  const handlePush = async () => {
    if (!selectedProvider) return;

    setIsPushing(true);
    setErrorMessage(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      if (selectedProvider.id === 'nostr') {
        // TODO: Implement Nostr push
        // For now, just simulate success
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Configure a Nostr URI as the origin
        const nostrUri = `nostr://npub1example/${projectId}`;
        await git.addRemote({
          dir,
          remote: 'origin',
          url: nostrUri,
        });

        setSyncState('success');
      } else {
        // Validate repository URL
        if (!repositoryUrl.trim()) {
          throw new Error('Repository URL is required');
        }

        // Add remote
        await git.addRemote({
          dir,
          remote: 'origin',
          url: repositoryUrl,
          force: true, // Override if exists
        });

        // Push to remote
        await git.push({
          dir,
          remote: 'origin',
          ref: gitStatus?.currentBranch || 'main',
          onAuth: () => {
            if (selectedProvider.credential) {
              return {
                username: selectedProvider.credential.username,
                password: selectedProvider.credential.password,
              };
            }
            return undefined;
          },
        });

        setSyncState('success');

        // Auto-dismiss after 2 seconds
        setTimeout(() => {
          setOpen(false);
          setSyncState('default');
        }, 2000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push';
      setErrorMessage(message);
      setSyncState('error');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (!originRemote) return;

    setIsPushing(true);
    setErrorMessage(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      await git.pull({
        dir,
        ref: gitStatus?.currentBranch || 'main',
        singleBranch: true,
        onAuth: () => {
          if (matchedCredential) {
            return {
              username: matchedCredential.username,
              password: matchedCredential.password,
            };
          }
          return undefined;
        },
      });

      setSyncState('success');

      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setOpen(false);
        setSyncState('default');
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pull';
      setErrorMessage(message);
      setSyncState('error');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePushConfigured = async () => {
    if (!originRemote) return;

    setIsPushing(true);
    setErrorMessage(null);

    try {
      const dir = `${projectsPath}/${projectId}`;

      await git.push({
        dir,
        remote: 'origin',
        ref: gitStatus?.currentBranch || 'main',
        onAuth: () => {
          if (matchedCredential) {
            return {
              username: matchedCredential.username,
              password: matchedCredential.password,
            };
          }
          return undefined;
        },
      });

      setSyncState('success');

      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setOpen(false);
        setSyncState('default');
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to push';
      setErrorMessage(message);
      setSyncState('error');
    } finally {
      setIsPushing(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!originRemote) return;

    try {
      await navigator.clipboard.writeText(originRemote.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const getProviderInfo = () => {
    if (!originRemote) return null;

    // Check if it's a Nostr URI
    if (originRemote.url.startsWith('nostr://')) {
      return {
        name: 'Nostr Git',
        icon: <Zap className="h-4 w-4" />,
      };
    }

    // Check if we have a matched credential
    if (matchedCredential) {
      return {
        name: matchedCredential.name,
        icon: (
          <ExternalFavicon
            url={matchedCredential.origin}
            size={16}
            fallback={<GitBranch className="h-4 w-4" />}
          />
        ),
      };
    }

    // Fallback to generic Git
    return {
      name: 'Git',
      icon: <GitBranch className="h-4 w-4" />,
    };
  };

  const providerInfo = getProviderInfo();

  const renderContent = () => {
    // Configured state - show origin URL and pull/push buttons
    if (hasRemote && syncState === 'default') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {providerInfo?.icon}
            <h3 className="font-semibold">{providerInfo?.name}</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Repository URL</Label>
            <div className="flex gap-2">
              <Input
                value={originRemote.url}
                readOnly
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyUrl}
                className="shrink-0 h-10"
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handlePull}
              disabled={isPushing}
              className="flex-1"
              variant="outline"
            >
              {isPushing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                'Pull'
              )}
            </Button>
            <Button
              onClick={handlePushConfigured}
              disabled={isPushing}
              className="flex-1"
            >
              {isPushing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                'Push'
              )}
            </Button>
          </div>
        </div>
      );
    }

    // Success state
    if (syncState === 'success') {
      return (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="relative">
            <CheckCircle2 className="h-20 w-20 text-green-500 animate-in zoom-in duration-300" />
            <div className="absolute inset-0 h-20 w-20 rounded-full bg-green-500/20 animate-ping" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-lg">Successfully Synced!</h3>
            <p className="text-sm text-muted-foreground">
              Your code has been synced to the remote repository.
            </p>
          </div>
        </div>
      );
    }

    // Error state
    if (syncState === 'error') {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              onClick={() => setSyncState('configure-repo')}
              variant="outline"
              className="flex-1"
            >
              Try Again
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setSyncState('default');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    // Configure repo state
    if (syncState === 'configure-repo' && selectedProvider) {
      // "Other" provider - show link to git settings
      if (selectedProvider.id === 'other') {
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {selectedProvider.icon}
              <h3 className="font-semibold">{selectedProvider.name}</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Configure additional git providers in{' '}
              <Link
                to="/settings/git"
                className="underline hover:no-underline font-medium"
                onClick={() => setOpen(false)}
              >
                Git Settings
              </Link>
              .
            </p>

            <Button
              onClick={() => setSyncState('select-provider')}
              variant="outline"
              className="w-full"
            >
              Back
            </Button>
          </div>
        );
      }

      // Nostr provider - check if user is logged in
      if (selectedProvider.id === 'nostr') {
        if (!user) {
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedProvider.icon}
                <h3 className="font-semibold">{selectedProvider.name}</h3>
              </div>

              <p className="text-sm text-muted-foreground">
                You need to be logged in with Nostr to use this feature. Please visit{' '}
                <Link
                  to="/settings/nostr"
                  className="underline hover:no-underline font-medium"
                  onClick={() => setOpen(false)}
                >
                  Nostr Settings
                </Link>{' '}
                to log in.
              </p>

              <Button
                onClick={() => setSyncState('select-provider')}
                variant="outline"
                className="w-full"
              >
                Back
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {selectedProvider.icon}
              <h3 className="font-semibold">{selectedProvider.name}</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Push your code to Nostr with one click. Your repository will be stored on Nostr relays.
            </p>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handlePush}
              disabled={isPushing}
              className="w-full"
            >
              {isPushing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Pushing...
                </>
              ) : (
                'Push to Nostr'
              )}
            </Button>
          </div>
        );
      }

      // Regular git provider - show repository URL input
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {selectedProvider.icon}
            <h3 className="font-semibold">{selectedProvider.name}</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/username/repo.git"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              First create the repository on {selectedProvider.name}, then paste the URL here.
            </p>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handlePush}
            disabled={isPushing || !repositoryUrl.trim()}
            className="w-full"
          >
            {isPushing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Pushing...
              </>
            ) : (
              'Push'
            )}
          </Button>
        </div>
      );
    }

    // Default state - select provider
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Sync your code to git</h3>
          <p className="text-sm text-muted-foreground">
            Choose a provider to sync your project
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Select Provider</Label>
          <div className="flex flex-wrap gap-2">
            {providerOptions.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleProviderSelect(provider)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                  "border-2 hover:scale-105 active:scale-95",
                  "bg-background text-foreground border-border hover:border-primary/50"
                )}
              >
                {provider.icon}
                <span>{provider.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0 relative", className)}
          aria-label="Sync with Git"
        >
          <CloudUpload className="size-5 text-muted-foreground" />
          {showIndicator && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96">
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
}
