import { useMemo } from 'react';
import { Git } from '@/lib/git';
import { useFS } from '@/hooks/useFS';
import { useNostr } from '@nostrify/react';
import { useAppContext } from '@/hooks/useAppContext';
import { useGitSettings } from './useGitSettings';
import { useCurrentUser } from './useCurrentUser';

/**
 * Hook that provides a Git instance configured with the virtual filesystem
 * and configurable CORS proxy for GitHub/GitLab repositories.
 */
export function useGit(): { git: Git } {
  const { fs } = useFS();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { config } = useAppContext();
  const { settings } = useGitSettings();
  const { corsProxy, gitProxyOrigins, relayMetadata, graspMetadata } = config;

  const relayList = useMemo(() => {
    // Extract hostnames from grasp relay URLs for backwards compatibility with Git class
    return relayMetadata.relays.map(r => {
      try {
        return { ...r, url: new URL(r.url) };
      } catch {
        return undefined;
      }
    }).filter((url): url is { url: URL, read: boolean; write: boolean; } => Boolean(url));
  }, [relayMetadata.relays]);

  const graspList = useMemo(() => {
    // Extract hostnames from grasp relay URLs for backwards compatibility with Git class
    return graspMetadata.relays.map(r => {
      try {
        return { url: new URL(r.url) };
      } catch {
        return undefined;
      }
    }).filter((relay): relay is { url: URL } => Boolean(relay));
  }, [graspMetadata.relays]);

  const git = useMemo(() => {
    return new Git({
      fs,
      nostr,
      corsProxy,
      gitProxyOrigins,
      relayList,
      graspList,
      credentials: settings.credentials,
      signer: user?.signer,
    });
  }, [fs, nostr, corsProxy, gitProxyOrigins, relayList, graspList, settings.credentials, user?.signer]);

  return { git };
}