import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import {
  ExternalLink,
  User,
  Star,
  ArrowLeft,
  Edit,
  MoreVertical,
  StarOff,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Home,
} from 'lucide-react';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { AppLayout } from '@/components/AppLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';

// Kind 31733 for app submissions
const APP_SUBMISSION_KIND = 31733;

// The moderator npub and hex
const MODERATOR_NPUB = 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc';
const MODERATOR_HEX = (() => {
  try {
    const decoded = nip19.decode(MODERATOR_NPUB);
    return decoded.type === 'npub' ? decoded.data : '';
  } catch {
    return '';
  }
})();

export default function ShowcasePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);

  // Decode the naddr to get the app submission
  const appData = React.useMemo(() => {
    if (!id) return null;
    try {
      const decoded = nip19.decode(id);
      if (decoded.type === 'naddr') {
        return decoded.data;
      }
    } catch (error) {
      console.error('Failed to decode naddr:', error);
    }
    return null;
  }, [id]);

  // Fetch the app submission event
  const { data: appEvent, isLoading } = useQuery({
    queryKey: ['showcase-app', id],
    queryFn: async () => {
      if (!appData) return null;

      const events = await nostr.query(
        [
          {
            kinds: [appData.kind],
            authors: [appData.pubkey],
            '#d': [appData.identifier],
            limit: 1,
          },
        ],
        { signal: AbortSignal.timeout(3000) }
      );

      return events[0] || null;
    },
    enabled: !!appData,
  });

  // Fetch moderation lists
  const { data: moderationData } = useQuery({
    queryKey: ['showcase-moderation', id],
    queryFn: async () => {
      if (!appEvent) return null;

      const [moderatorListEvents, reportEvents] = await Promise.all([
        nostr.query(
          [
            {
              kinds: [30267],
              authors: [MODERATOR_HEX],
              '#d': [
                'soapbox-featured-apps',
                'soapbox-approved-apps',
                'soapbox-homepage-apps',
              ],
              limit: 3,
            },
          ],
          { signal: AbortSignal.timeout(1000) }
        ),
        nostr.query(
          [
            {
              kinds: [1984],
              authors: [MODERATOR_HEX],
              limit: 1000,
            },
          ],
          { signal: AbortSignal.timeout(1000) }
        ),
      ]);

      // Process moderation lists
      const featuredList = moderatorListEvents.find((e) =>
        e.tags.find((tag) => tag[0] === 'd' && tag[1] === 'soapbox-featured-apps')
      );
      const approvedList = moderatorListEvents.find((e) =>
        e.tags.find((tag) => tag[0] === 'd' && tag[1] === 'soapbox-approved-apps')
      );
      const homepageList = moderatorListEvents.find((e) =>
        e.tags.find((tag) => tag[0] === 'd' && tag[1] === 'soapbox-homepage-apps')
      );

      const dTag = appEvent.tags.find((tag) => tag[0] === 'd')?.[1];
      const appCoordinate = `${APP_SUBMISSION_KIND}:${appEvent.pubkey}:${dTag}`;

      const isFeatured = featuredList?.tags.some(
        (tag) => tag[0] === 'a' && tag[1] === appCoordinate
      );
      const isApproved = approvedList?.tags.some(
        (tag) => tag[0] === 'a' && tag[1] === appCoordinate
      );
      const isHomepage = homepageList?.tags.some(
        (tag) => tag[0] === 'a' && tag[1] === appCoordinate
      );

      // Check if hidden
      const appReports = new Map<string, { hidden: number; unhidden: number }>();
      for (const report of reportEvents) {
        const aTag = report.tags.find((tag) => tag[0] === 'a');
        if (!aTag || !aTag[1]) continue;

        const reportCoord = aTag[1];
        if (reportCoord !== appCoordinate) continue;

        const reportType = aTag[2];
        const moderationLabel = report.tags.find(
          (tag) => tag[0] === 'l' && tag[2] === 'soapbox.moderation'
        )?.[1];

        if (moderationLabel === 'hidden' && (reportType === 'spam' || reportType === 'other')) {
          if (!appReports.has(reportCoord)) {
            appReports.set(reportCoord, { hidden: 0, unhidden: 0 });
          }
          appReports.get(reportCoord)!.hidden = Math.max(
            appReports.get(reportCoord)!.hidden,
            report.created_at
          );
        } else if (moderationLabel === 'unhidden' && reportType === 'other') {
          if (!appReports.has(reportCoord)) {
            appReports.set(reportCoord, { hidden: 0, unhidden: 0 });
          }
          appReports.get(reportCoord)!.unhidden = Math.max(
            appReports.get(reportCoord)!.unhidden,
            report.created_at
          );
        }
      }

      const reports = appReports.get(appCoordinate);
      const isHidden = reports && reports.hidden > reports.unhidden;

      return { isFeatured, isApproved, isHomepage, isHidden };
    },
    enabled: !!appEvent,
    staleTime: 5000, // 5 seconds
    refetchInterval: 15000, // 15 seconds
  });

  // Parse app data from event
  const app = React.useMemo(() => {
    if (!appEvent) return null;

    const appName = appEvent.tags.find((tag) => tag[0] === 'title')?.[1] || '';
    const websiteUrl = appEvent.tags.find((tag) => tag[0] === 'website')?.[1] || '';
    const repositoryUrl = appEvent.tags.find((tag) => tag[0] === 'repository')?.[1] || '';
    const appIconUrl = appEvent.tags.find((tag) => tag[0] === 'icon')?.[1] || '';
    const screenshotUrl = appEvent.tags.find((tag) => tag[0] === 'screenshot')?.[1] || '';
    const authorNpub = appEvent.tags.find((tag) => tag[0] === 'author')?.[1] || appEvent.pubkey;
    const appTags = appEvent.tags.filter((tag) => tag[0] === 'app-tag').map((tag) => tag[1]);

    return {
      appName,
      websiteUrl,
      repositoryUrl,
      description: appEvent.content,
      appIconUrl,
      screenshotUrl,
      authorNpub,
      appTags,
    };
  }, [appEvent]);

  // Get author pubkey
  const authorPubkey = React.useMemo(() => {
    if (!app?.authorNpub) return appEvent?.pubkey || '';

    try {
      if (app.authorNpub.length === 64 && /^[0-9a-f]+$/i.test(app.authorNpub)) {
        return app.authorNpub;
      }

      const decoded = nip19.decode(app.authorNpub);
      return decoded.type === 'npub' ? decoded.data : appEvent?.pubkey || '';
    } catch {
      return appEvent?.pubkey || '';
    }
  }, [app?.authorNpub, appEvent?.pubkey]);

  const { data: authorData } = useAuthor(authorPubkey);

  const isOwner = user?.pubkey === appEvent?.pubkey;
  const isModerator = user?.pubkey === MODERATOR_HEX;

  // Moderation actions
  const handleModerationAction = async (
    action: 'feature' | 'unfeature' | 'approve' | 'unapprove' | 'hide' | 'unhide' | 'homepage' | 'unhomepage'
  ) => {
    if (!isModerator || !user || !appEvent) return;

    const dTag = appEvent.tags.find((tag) => tag[0] === 'd')?.[1];
    if (!dTag) {
      toast({
        title: 'Error',
        description: 'Cannot perform moderation action: missing app identifier',
        variant: 'destructive',
      });
      return;
    }

    const appCoordinate = `${APP_SUBMISSION_KIND}:${appEvent.pubkey}:${dTag}`;

    try {
      if (action === 'homepage' || action === 'unhomepage') {
        const currentHomepageLists = await nostr.query(
          [
            {
              kinds: [30267],
              authors: [MODERATOR_HEX],
              '#d': ['soapbox-homepage-apps'],
              limit: 1,
            },
          ],
          { signal: AbortSignal.timeout(3000) }
        );

        const currentHomepageList = currentHomepageLists.reduce(
          (latest: NostrEvent | null, current: NostrEvent) =>
            !latest || current.created_at > latest.created_at ? current : latest,
          null as NostrEvent | null
        );

        const currentHomepageApps = new Set<string>();
        if (currentHomepageList) {
          currentHomepageList.tags
            .filter((tag) => tag[0] === 'a')
            .forEach((tag) => currentHomepageApps.add(tag[1]));
        }

        if (action === 'homepage') {
          currentHomepageApps.add(appCoordinate);
        } else {
          currentHomepageApps.delete(appCoordinate);
        }

        publishEvent({
          kind: 30267,
          content: 'Soapbox homepage apps curated by moderators',
          tags: [
            ['d', 'soapbox-homepage-apps'],
            ['title', 'Soapbox Homepage Apps'],
            ['description', 'Apps displayed on the Soapbox homepage'],
            ...Array.from(currentHomepageApps).map((coord) => ['a', coord]),
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        if (action === 'homepage') {
          const currentApprovedLists = await nostr.query(
            [
              {
                kinds: [30267],
                authors: [MODERATOR_HEX],
                '#d': ['soapbox-approved-apps'],
                limit: 1,
              },
            ],
            { signal: AbortSignal.timeout(3000) }
          );

          const currentApprovedList = currentApprovedLists.reduce(
            (latest: NostrEvent | null, current: NostrEvent) =>
              !latest || current.created_at > latest.created_at ? current : latest,
            null as NostrEvent | null
          );

          const currentApprovedApps = new Set<string>();
          if (currentApprovedList) {
            currentApprovedList.tags
              .filter((tag) => tag[0] === 'a')
              .forEach((tag) => currentApprovedApps.add(tag[1]));
          }

          currentApprovedApps.add(appCoordinate);

          publishEvent({
            kind: 30267,
            content: 'Soapbox approved apps curated by moderators',
            tags: [
              ['d', 'soapbox-approved-apps'],
              ['title', 'Soapbox Approved Apps'],
              ['description', 'Apps approved for the Soapbox showcase'],
              ...Array.from(currentApprovedApps).map((coord) => ['a', coord]),
            ],
            created_at: Math.floor(Date.now() / 1000),
          });
        }
      } else if (action === 'feature' || action === 'unfeature') {
        const currentFeaturedLists = await nostr.query(
          [
            {
              kinds: [30267],
              authors: [MODERATOR_HEX],
              '#d': ['soapbox-featured-apps'],
              limit: 1,
            },
          ],
          { signal: AbortSignal.timeout(3000) }
        );

        const currentFeaturedList = currentFeaturedLists.reduce(
          (latest: NostrEvent | null, current: NostrEvent) =>
            !latest || current.created_at > latest.created_at ? current : latest,
          null as NostrEvent | null
        );

        const currentFeaturedApps = new Set<string>();
        if (currentFeaturedList) {
          currentFeaturedList.tags
            .filter((tag) => tag[0] === 'a')
            .forEach((tag) => currentFeaturedApps.add(tag[1]));
        }

        if (action === 'feature') {
          currentFeaturedApps.add(appCoordinate);
        } else {
          currentFeaturedApps.delete(appCoordinate);
        }

        publishEvent({
          kind: 30267,
          content: 'Soapbox featured apps curated by moderators',
          tags: [
            ['d', 'soapbox-featured-apps'],
            ['title', 'Soapbox Featured Apps'],
            ['description', 'Apps featured in the Soapbox showcase'],
            ...Array.from(currentFeaturedApps).map((coord) => ['a', coord]),
          ],
          created_at: Math.floor(Date.now() / 1000),
        });

        if (action === 'feature') {
          const currentApprovedLists = await nostr.query(
            [
              {
                kinds: [30267],
                authors: [MODERATOR_HEX],
                '#d': ['soapbox-approved-apps'],
                limit: 1,
              },
            ],
            { signal: AbortSignal.timeout(3000) }
          );

          const currentApprovedList = currentApprovedLists.reduce(
            (latest: NostrEvent | null, current: NostrEvent) =>
              !latest || current.created_at > latest.created_at ? current : latest,
            null as NostrEvent | null
          );

          const currentApprovedApps = new Set<string>();
          if (currentApprovedList) {
            currentApprovedList.tags
              .filter((tag) => tag[0] === 'a')
              .forEach((tag) => currentApprovedApps.add(tag[1]));
          }

          currentApprovedApps.add(appCoordinate);

          publishEvent({
            kind: 30267,
            content: 'Soapbox approved apps curated by moderators',
            tags: [
              ['d', 'soapbox-approved-apps'],
              ['title', 'Soapbox Approved Apps'],
              ['description', 'Apps approved for the Soapbox showcase'],
              ...Array.from(currentApprovedApps).map((coord) => ['a', coord]),
            ],
            created_at: Math.floor(Date.now() / 1000),
          });
        }
      } else if (action === 'approve' || action === 'unapprove') {
        const currentApprovedLists = await nostr.query(
          [
            {
              kinds: [30267],
              authors: [MODERATOR_HEX],
              '#d': ['soapbox-approved-apps'],
              limit: 1,
            },
          ],
          { signal: AbortSignal.timeout(3000) }
        );

        const currentApprovedList = currentApprovedLists.reduce(
          (latest: NostrEvent | null, current: NostrEvent) =>
            !latest || current.created_at > latest.created_at ? current : latest,
          null as NostrEvent | null
        );

        const currentApprovedApps = new Set<string>();
        if (currentApprovedList) {
          currentApprovedList.tags
            .filter((tag) => tag[0] === 'a')
            .forEach((tag) => currentApprovedApps.add(tag[1]));
        }

        if (action === 'approve') {
          currentApprovedApps.add(appCoordinate);
        } else {
          currentApprovedApps.delete(appCoordinate);
        }

        publishEvent({
          kind: 30267,
          content: 'Soapbox approved apps curated by moderators',
          tags: [
            ['d', 'soapbox-approved-apps'],
            ['title', 'Soapbox Approved Apps'],
            ['description', 'Apps approved for the Soapbox showcase'],
            ...Array.from(currentApprovedApps).map((coord) => ['a', coord]),
          ],
          created_at: Math.floor(Date.now() / 1000),
        });
      } else if (action === 'hide' || action === 'unhide') {
        publishEvent({
          kind: 1984,
          content: `App ${action}den by moderator: "${app?.appName}"`,
          tags: [
            ['a', appCoordinate, action === 'hide' ? 'spam' : 'other'],
            ['p', appEvent.pubkey],
            ['L', 'soapbox.moderation'],
            ['l', action === 'hide' ? 'hidden' : 'unhidden', 'soapbox.moderation'],
          ],
          created_at: Math.floor(Date.now() / 1000),
        });
      }

      // Invalidate queries immediately for real-time updates
      queryClient.invalidateQueries({ queryKey: ['showcase-moderation', id] });
      queryClient.invalidateQueries({ queryKey: ['nostr', 'app-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['app-submissions'] });

      toast({
        title: 'Success!',
        description: `App "${app?.appName}" ${action}d successfully`,
      });
    } catch (error) {
      console.error('Moderation action failed:', error);
      toast({
        title: 'Error',
        description: `Failed to ${action} app "${app?.appName}"`,
        variant: 'destructive',
      });
    }
  };

  if (!id || !appData) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Card className="border-dashed">
            <CardContent className="py-12 px-8 text-center">
              <p className="text-muted-foreground">Invalid showcase app identifier</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isLoading || !appEvent || !app) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="mb-6">
            <Skeleton className="h-10 w-32" />
          </div>

          <Card className="mb-8">
            <Skeleton className="aspect-video rounded-t-lg" />
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <Skeleton className="w-16 h-16 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex gap-2 mb-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>

          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back button */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* App Details Card */}
        <Card className="mb-8">
          <div className="relative">
            {/* Screenshot */}
            <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted rounded-t-lg overflow-hidden">
              {!imageError ? (
                <img
                  src={app.screenshotUrl}
                  alt={`${app.appName} screenshot`}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-2 bg-muted rounded-lg flex items-center justify-center">
                      <ExternalLink className="w-8 h-8" />
                    </div>
                    <p className="text-sm">Screenshot unavailable</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Menu */}
            {(isOwner || isModerator) && (
              <div className="absolute top-4 right-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="h-9 w-9 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isOwner && (
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit App
                      </DropdownMenuItem>
                    )}
                    {isModerator && moderationData && (
                      <>
                        {!moderationData.isApproved && (
                          <DropdownMenuItem
                            onClick={() => handleModerationAction('approve')}
                            disabled={isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </DropdownMenuItem>
                        )}
                        {moderationData.isApproved && !moderationData.isFeatured && (
                          <DropdownMenuItem
                            onClick={() => handleModerationAction('unapprove')}
                            disabled={isPending}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Unapprove
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            handleModerationAction(moderationData.isFeatured ? 'unfeature' : 'feature')
                          }
                          disabled={isPending}
                        >
                          {moderationData.isFeatured ? (
                            <>
                              <StarOff className="w-4 h-4 mr-2" />
                              Un-feature
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4 mr-2" />
                              Feature
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleModerationAction(moderationData.isHomepage ? 'unhomepage' : 'homepage')
                          }
                          disabled={isPending}
                        >
                          {moderationData.isHomepage ? (
                            <>
                              <Home className="w-4 h-4 mr-2" />
                              Remove from Homepage
                            </>
                          ) : (
                            <>
                              <Home className="w-4 h-4 mr-2" />
                              Add to Homepage
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            handleModerationAction(moderationData.isHidden ? 'unhide' : 'hide')
                          }
                          disabled={isPending}
                        >
                          {moderationData.isHidden ? (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Unhide
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide
                            </>
                          )}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <CardContent className="p-6">
            {/* App Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={app.appIconUrl}
                  alt={`${app.appName} icon`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-2">{app.appName}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {authorData?.metadata?.picture ? (
                      <img
                        src={authorData.metadata.picture}
                        alt={`${authorData.metadata.name || 'Author'} avatar`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.innerHTML =
                            '<div class="w-full h-full flex items-center justify-center"><svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg></div>';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span>
                    by{' '}
                    <a
                      href={`https://ditto.pub/${app.authorNpub || nip19.npubEncode(authorPubkey)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors hover:underline"
                    >
                      {authorData?.metadata?.name ||
                        authorData?.metadata?.display_name ||
                        'Anonymous'}
                    </a>
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{app.description}</p>

            {/* Tags */}
            {app.appTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {app.appTags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Link
                to={`/clone?url=${encodeURIComponent(app.repositoryUrl)}`}
                className="flex-1 min-w-[200px]"
              >
                <img
                  src="/badge.svg"
                  alt="Edit with Shakespeare"
                  className="h-10 hover:opacity-80 transition-opacity"
                />
              </Link>
              <Button variant="default" size="lg" asChild>
                <a href={app.websiteUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Visit Website
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ratings Section */}
        <Card className="mb-8">
          <CardHeader>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              Ratings
            </h2>
          </CardHeader>
          <CardContent>
            <RatingsSection appEvent={appEvent} />
          </CardContent>
        </Card>

        {/* Comments Section */}
        <CommentsSection
          root={appEvent}
          title="Comments"
          emptyStateMessage="No comments yet"
          emptyStateSubtitle="Be the first to share your thoughts about this app!"
        />
      </div>
    </AppLayout>
  );
}

// Ratings Section Component
function RatingsSection({ appEvent }: { appEvent: NostrEvent }) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ratings (kind 7 reactions with rating content)
  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ['ratings', appEvent.id],
    queryFn: async () => {
      const events = await nostr.query(
        [
          {
            kinds: [7],
            '#e': [appEvent.id],
            limit: 500,
          },
        ],
        { signal: AbortSignal.timeout(3000) }
      );

      // Filter for numeric ratings (1-5)
      return events.filter((e) => {
        const rating = parseInt(e.content);
        return !isNaN(rating) && rating >= 1 && rating <= 5;
      });
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // 30 seconds
  });

  // Calculate average rating
  const averageRating = React.useMemo(() => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + parseInt(r.content), 0);
    return sum / ratings.length;
  }, [ratings]);

  // Check if user has already rated
  const userRating = React.useMemo(() => {
    if (!user) return null;
    const userRatingEvent = ratings.find((r) => r.pubkey === user.pubkey);
    return userRatingEvent ? parseInt(userRatingEvent.content) : null;
  }, [ratings, user]);

  const handleRate = (rating: number) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please log in to rate this app',
        variant: 'destructive',
      });
      return;
    }

    // Optimistic update
    const optimisticRating = {
      id: `temp-${Date.now()}`,
      pubkey: user.pubkey,
      content: rating.toString(),
      created_at: Math.floor(Date.now() / 1000),
      kind: 7,
      tags: [['e', appEvent.id], ['p', appEvent.pubkey]],
      sig: ''
    };

    // Update cache optimistically
    queryClient.setQueryData(['ratings', appEvent.id], (oldRatings: NostrEvent[] = []) => {
      // Remove any existing rating from this user
      const filteredRatings = oldRatings.filter(r => r.pubkey !== user.pubkey);
      // Add the new rating
      return [...filteredRatings, optimisticRating];
    });

    publishEvent({
      kind: 7,
      content: rating.toString(),
      tags: [
        ['e', appEvent.id],
        ['p', appEvent.pubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    }, {
      onSuccess: () => {
        toast({
          title: 'Rating Submitted!',
          description: `You rated this app ${rating} star${rating > 1 ? 's' : ''}`,
        });
      },
      onError: () => {
        // Revert optimistic update on error
        queryClient.invalidateQueries({ queryKey: ['ratings', appEvent.id] });
        toast({
          title: 'Error',
          description: 'Failed to submit rating. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Average Rating Display */}
      <div className="text-center">
        <div className="text-5xl font-bold mb-2">
          {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings yet'}
        </div>
        {averageRating > 0 && (
          <div className="flex items-center justify-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-6 h-6 ${
                  i < Math.round(averageRating)
                    ? 'fill-yellow-500 text-yellow-500'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
        </p>
      </div>

      {/* User Rating Input */}
      <div className="border-t pt-6">
        <p className="text-sm font-medium mb-3">
          {userRating ? 'Your rating:' : 'Rate this app:'}
        </p>
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const starValue = i + 1;
            return (
              <button
                key={i}
                onClick={() => handleRate(starValue)}
                className="transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!user || isPending}
              >
                <Star
                  className={`w-10 h-10 ${
                    userRating && starValue <= userRating
                      ? 'fill-yellow-500 text-yellow-500'
                      : 'text-gray-300 hover:text-yellow-500'
                  } ${isPending ? 'animate-pulse' : ''}`}
                />
              </button>
            );
          })}
        </div>
        {!user && (
          <p className="text-xs text-muted-foreground mt-2">Log in to rate this app</p>
        )}
      </div>
    </div>
  );
}
