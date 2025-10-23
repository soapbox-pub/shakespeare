import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import badgeSvg from '/badge.svg?url';
import {
  ExternalLink,
  Edit,
  Star,
  StarOff,
  Eye,
  EyeOff,
  MoreVertical,
  CheckCircle,
  XCircle,
  User,
  Home,
  Contact
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AppSubmission } from '@/hooks/useAppSubmissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useNostr } from '@nostrify/react';
import { useAuthor } from '@/hooks/useAuthor';
import { nip19 } from 'nostr-tools';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

interface AppShowcaseCardProps {
  app: AppSubmission;
  onEdit?: (app: AppSubmission) => void;
  showModerationControls?: boolean;
  hideApprovalStatus?: boolean; // Hide pending/approval badges
}

export function AppShowcaseCard({ app, onEdit, showModerationControls, hideApprovalStatus: _hideApprovalStatus }: AppShowcaseCardProps) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { mutate: publishEvent, isPending } = useNostrPublish();
  const queryClient = useQueryClient();
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  // Get author pubkey from authorNpub field
  const authorPubkey = React.useMemo(() => {
    if (!app.authorNpub) return app.pubkey; // Fallback to event pubkey

    try {
      // If it's already a hex key, use it directly
      if (app.authorNpub.length === 64 && /^[0-9a-f]+$/i.test(app.authorNpub)) {
        return app.authorNpub;
      }

      // Otherwise try to decode as npub
      const decoded = nip19.decode(app.authorNpub);
      return decoded.type === 'npub' ? decoded.data : app.pubkey;
    } catch {
      return app.pubkey; // Fallback to event pubkey if decode fails
    }
  }, [app.authorNpub, app.pubkey]);

  const { data: authorData } = useAuthor(authorPubkey);
  const isOwner = user?.pubkey === app.pubkey;
  const MODERATOR_NPUB = 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc';
  const MODERATOR_HEX = (() => {
    try {
      const decoded = nip19.decode(MODERATOR_NPUB);
      return decoded.type === 'npub' ? decoded.data : '';
    } catch {
      return '';
    }
  })();
  const isModerator = user?.pubkey === MODERATOR_HEX;

  // Check if this is a Halloween submission by looking for Halloween tags
  const isHalloweenSubmission = app.appTags.includes('Halloween Hackathon 2025');

  // Get contact info from Halloween submissions (these have lightning/email tags)
  const getContactInfo = () => {
    if (!isHalloweenSubmission) return null;

    // Look for lightning and email tags in the event tags
    const lightningTag = app.tags?.find((tag: string[]) => tag[0] === 'lightning')?.[1];
    const emailTag = app.tags?.find((tag: string[]) => tag[0] === 'email')?.[1];

    return { lightning: lightningTag, email: emailTag };
  };

  const handleCopyContactInfo = () => {
    const contactInfo = getContactInfo();
    if (!contactInfo) return;

    const info: string[] = [];
    if (contactInfo.lightning) info.push(`Lightning: ${contactInfo.lightning}`);
    if (contactInfo.email) info.push(`Email: ${contactInfo.email}`);

    const textToCopy = info.join('\n');
    navigator.clipboard.writeText(textToCopy);

    toast({
      title: 'Contact Info Copied!',
      description: `Copied ${info.length} contact method(s) to clipboard`
    });
  };

  const handleModerationAction = async (action: 'feature' | 'unfeature' | 'approve' | 'unapprove' | 'hide' | 'unhide' | 'homepage' | 'unhomepage') => {
    if (!isModerator || !user) return;

    const dTag = app.tags.find(tag => tag[0] === 'd')?.[1];
    if (!dTag) {
      toast({
        title: 'Error',
        description: 'Cannot perform moderation action: missing app identifier',
        variant: 'destructive'
      });
      return;
    }

    const appCoordinate = `${app.kind}:${app.pubkey}:${dTag}`;

    try {
      if (action === 'homepage' || action === 'unhomepage') {
        // Get current homepage apps list
        const currentHomepageLists = await nostr.query([{
          kinds: [30267],
          authors: [MODERATOR_HEX],
          '#d': ['soapbox-homepage-apps'],
          limit: 1
        }]);

        const currentHomepageList = currentHomepageLists.reduce((latest: NostrEvent | null, current: NostrEvent) =>
          !latest || current.created_at > latest.created_at ? current : latest,
          null as NostrEvent | null
        );

        // Get current homepage app coordinates
        const currentHomepageApps = new Set<string>();
        if (currentHomepageList) {
          currentHomepageList.tags
            .filter(tag => tag[0] === 'a')
            .forEach(tag => currentHomepageApps.add(tag[1]));
        }

        // Update the homepage set
        if (action === 'homepage') {
          currentHomepageApps.add(appCoordinate);
        } else {
          currentHomepageApps.delete(appCoordinate);
        }

        // Publish updated homepage apps list
        publishEvent({
          kind: 30267,
          content: 'Soapbox homepage apps curated by moderators',
          tags: [
            ['d', 'soapbox-homepage-apps'],
            ['title', 'Soapbox Homepage Apps'],
            ['description', 'Apps displayed on the Soapbox homepage'],
            ...Array.from(currentHomepageApps).map(coord => ['a', coord])
          ],
          created_at: Math.floor(Date.now() / 1000)
        });

        // If adding to homepage, also ensure it's approved
        if (action === 'homepage') {
          // Get current approved apps list
          const currentApprovedLists = await nostr.query([{
            kinds: [30267],
            authors: [MODERATOR_HEX],
            '#d': ['soapbox-approved-apps'],
            limit: 1
          }]);

          const currentApprovedList = currentApprovedLists.reduce((latest: NostrEvent | null, current: NostrEvent) =>
            !latest || current.created_at > latest.created_at ? current : latest,
            null as NostrEvent | null
          );

          // Get current approved app coordinates
          const currentApprovedApps = new Set<string>();
          if (currentApprovedList) {
            currentApprovedList.tags
              .filter(tag => tag[0] === 'a')
              .forEach(tag => currentApprovedApps.add(tag[1]));
          }

          // Add to approved list if not already there
          currentApprovedApps.add(appCoordinate);

          // Publish updated approved apps list
          publishEvent({
            kind: 30267,
            content: 'Soapbox approved apps curated by moderators',
            tags: [
              ['d', 'soapbox-approved-apps'],
              ['title', 'Soapbox Approved Apps'],
              ['description', 'Apps approved for the Soapbox showcase'],
              ...Array.from(currentApprovedApps).map(coord => ['a', coord])
            ],
            created_at: Math.floor(Date.now() / 1000)
          });
        }

      } else if (action === 'feature' || action === 'unfeature') {
        // Get current featured apps list
        const currentFeaturedLists = await nostr.query([{
          kinds: [30267],
          authors: [MODERATOR_HEX],
          '#d': ['soapbox-featured-apps'],
          limit: 1
        }]);

        const currentFeaturedList = currentFeaturedLists.reduce((latest: NostrEvent | null, current: NostrEvent) =>
          !latest || current.created_at > latest.created_at ? current : latest,
          null as NostrEvent | null
        );

        // Get current featured app coordinates
        const currentFeaturedApps = new Set<string>();
        if (currentFeaturedList) {
          currentFeaturedList.tags
            .filter(tag => tag[0] === 'a')
            .forEach(tag => currentFeaturedApps.add(tag[1]));
        }

        // Update the featured set
        if (action === 'feature') {
          currentFeaturedApps.add(appCoordinate);
        } else {
          currentFeaturedApps.delete(appCoordinate);
        }

        // Publish updated featured apps list
        publishEvent({
          kind: 30267,
          content: 'Soapbox featured apps curated by moderators',
          tags: [
            ['d', 'soapbox-featured-apps'],
            ['title', 'Soapbox Featured Apps'],
            ['description', 'Apps featured in the Soapbox showcase'],
            ...Array.from(currentFeaturedApps).map(coord => ['a', coord])
          ],
          created_at: Math.floor(Date.now() / 1000)
        });

        // If featuring an app, also ensure it's approved
        if (action === 'feature') {
          // Get current approved apps list
          const currentApprovedLists = await nostr.query([{
            kinds: [30267],
            authors: [MODERATOR_HEX],
            '#d': ['soapbox-approved-apps'],
            limit: 1
          }]);

          const currentApprovedList = currentApprovedLists.reduce((latest: NostrEvent | null, current: NostrEvent) =>
            !latest || current.created_at > latest.created_at ? current : latest,
            null as NostrEvent | null
          );

          // Get current approved app coordinates
          const currentApprovedApps = new Set<string>();
          if (currentApprovedList) {
            currentApprovedList.tags
              .filter(tag => tag[0] === 'a')
              .forEach(tag => currentApprovedApps.add(tag[1]));
          }

          // Add to approved list if not already there
          currentApprovedApps.add(appCoordinate);

          // Publish updated approved apps list
          publishEvent({
            kind: 30267,
            content: 'Soapbox approved apps curated by moderators',
            tags: [
              ['d', 'soapbox-approved-apps'],
              ['title', 'Soapbox Approved Apps'],
              ['description', 'Apps approved for the Soapbox showcase'],
              ...Array.from(currentApprovedApps).map(coord => ['a', coord])
            ],
            created_at: Math.floor(Date.now() / 1000)
          });
        }

      } else if (action === 'approve' || action === 'unapprove') {
        // Get current approved apps list
        const currentApprovedLists = await nostr.query([{
          kinds: [30267],
          authors: [MODERATOR_HEX],
          '#d': ['soapbox-approved-apps'],
          limit: 1
        }]);

        const currentApprovedList = currentApprovedLists.reduce((latest: NostrEvent | null, current: NostrEvent) =>
          !latest || current.created_at > latest.created_at ? current : latest,
          null as NostrEvent | null
        );

        // Get current approved app coordinates
        const currentApprovedApps = new Set<string>();
        if (currentApprovedList) {
          currentApprovedList.tags
            .filter(tag => tag[0] === 'a')
            .forEach(tag => currentApprovedApps.add(tag[1]));
        }

        // Update the approved set
        if (action === 'approve') {
          currentApprovedApps.add(appCoordinate);
        } else {
          currentApprovedApps.delete(appCoordinate);
        }

        // Publish updated approved apps list
        publishEvent({
          kind: 30267,
          content: 'Soapbox approved apps curated by moderators',
          tags: [
            ['d', 'soapbox-approved-apps'],
            ['title', 'Soapbox Approved Apps'],
            ['description', 'Apps approved for the Soapbox showcase'],
            ...Array.from(currentApprovedApps).map(coord => ['a', coord])
          ],
          created_at: Math.floor(Date.now() / 1000)
        });

      } else if (action === 'hide' || action === 'unhide') {
        // Create NIP-56 report event
        publishEvent({
          kind: 1984,
          content: `App ${action}den by moderator: "${app.appName}"`,
          tags: [
            ['a', appCoordinate, action === 'hide' ? 'spam' : 'other'],
            ['p', app.pubkey],
            ['L', 'soapbox.moderation'],
            ['l', action === 'hide' ? 'hidden' : 'unhidden', 'soapbox.moderation']
          ],
          created_at: Math.floor(Date.now() / 1000)
        });
      }

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['app-submissions'] });

      // If this is a Halloween app, also invalidate Halloween queries
      if (isHalloweenSubmission) {
        queryClient.invalidateQueries({ queryKey: ['halloween-submissions'] });
        queryClient.invalidateQueries({ queryKey: ['halloween-submissions-with-contacts'] });
      }

      toast({
        title: 'Success!',
        description: `App "${app.appName}" ${action}d successfully`
      });

    } catch (error) {
      console.error('Moderation action failed:', error);
      toast({
        title: 'Error',
        description: `Failed to ${action} app "${app.appName}"`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/20 h-full flex flex-col">
      <div className="relative">
        {/* App Screenshot */}
        <a
          href={app.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-video bg-gradient-to-br from-muted/50 to-muted rounded-t-lg overflow-hidden cursor-pointer"
        >
          {!imageError ? (
            <img
              src={app.screenshotUrl}
              alt={`${app.appName} screenshot`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        </a>

        {/* Actions Menu */}
        {(isOwner || showModerationControls) && (
          <div className="absolute top-3 right-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner && (
                  <DropdownMenuItem onClick={() => onEdit?.(app)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit App
                  </DropdownMenuItem>
                )}
                {showModerationControls && isModerator && (
                  <>
                    {isHalloweenSubmission && getContactInfo() && (getContactInfo()?.lightning || getContactInfo()?.email) && (
                      <DropdownMenuItem
                        onClick={handleCopyContactInfo}
                      >
                        <Contact className="w-4 h-4 mr-2" />
                        View Contact Info
                      </DropdownMenuItem>
                    )}
                    {!app.isApproved && (
                      <DropdownMenuItem
                        onClick={() => handleModerationAction('approve')}
                        disabled={isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </DropdownMenuItem>
                    )}
                    {app.isApproved && !app.isFeatured && (
                      <DropdownMenuItem
                        onClick={() => handleModerationAction('unapprove')}
                        disabled={isPending}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Unapprove
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleModerationAction(app.isFeatured ? 'unfeature' : 'feature')}
                      disabled={isPending}
                    >
                      {app.isFeatured ? (
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
                      onClick={() => handleModerationAction(app.isHomepage ? 'unhomepage' : 'homepage')}
                      disabled={isPending}
                    >
                      {app.isHomepage ? (
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
                      onClick={() => handleModerationAction(app.isHidden ? 'unhide' : 'hide')}
                      disabled={isPending}
                    >
                      {app.isHidden ? (
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

      <CardContent className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* App Icon */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
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
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-1" title={app.appName}>
                {app.appName.length > 50 ? `${app.appName.slice(0, 50)}...` : app.appName}
              </h3>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground mb-3 line-clamp-3">{app.description}</p>

        {/* Author Information */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
            {authorData?.metadata?.picture ? (
              <img
                src={authorData.metadata.picture}
                alt={`${authorData.metadata.name || 'Author'} avatar`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg></div>';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            by{' '}
            <a
              href={`https://ditto.pub/${app.authorNpub || nip19.npubEncode(authorPubkey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors hover:underline"
            >
              {authorData?.metadata?.name || authorData?.metadata?.display_name || 'Anonymous'}
            </a>
          </span>
        </div>

        {/* Spacer to push action links to bottom */}
        <div className="flex-1"></div>

        {/* Action Links */}
        <div className="flex items-center gap-2 mt-auto">
          <Link
            to={`/clone?url=${encodeURIComponent(app.repositoryUrl)}`}
            className="flex-1"
          >
            <img
              src={badgeSvg}
              alt="Edit with Shakespeare"
              className="h-6 hover:opacity-80 transition-opacity"
            />
          </Link>
          <Button variant="outline" size="sm" asChild>
            <a
              href={app.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Visit app"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}