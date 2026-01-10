import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Search, Compass } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRepositories } from '@/hooks/useUserRepositories';
import { useContacts } from '@/hooks/useContacts';
import { useFollowedRepositories } from '@/hooks/useFollowedRepositories';
import { RepositoryCard } from '@/components/RepositoryCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { Repository } from '@/hooks/useUserRepositories';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { NSchema as n } from '@nostrify/nostrify';
import type { NostrMetadata } from '@nostrify/nostrify';
import { useSeoMeta } from '@unhead/react';

export default function Explore() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { data: repositories = [], isLoading: isLoadingRepos } = useUserRepositories(user?.pubkey);
  const { data: contacts = [] } = useContacts(user?.pubkey);
  const { data: followedRepositories = [], isLoading: isLoadingFollowedRepos } = useFollowedRepositories(contacts);
  const [activeTab, setActiveTab] = useState<'my-projects' | 'follows'>('follows');
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
    title: `${t('explore')} - Shakespeare`,
    description: t('exploreRepositories'),
  });

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

  if (!user) {
    return (
      <AppLayout title={t('exploreApps')}>
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-lg text-muted-foreground">
            {t('pleaseLogInToExplore')}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('exploreApps')}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Compass className="h-8 w-8 text-primary flex-shrink-0" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('exploreApps')}
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {t('exploreRepositories')}
          </p>
        </div>

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
    </AppLayout>
  );
}
