import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

// Kind 31733 for app submissions (addressable events)
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

// Soapbox team follow pack naddr (same as used on About page)
const SOAPBOX_TEAM_NADDR = 'naddr1qvzqqqyckypzpyexz3t34l966ngh5xg7u2q788hthdqmj0av3lv8s2tz9t43zt6dqqxxkdrsx4mnqm3jxfeh2ess5pyrw';

export interface AppSubmission extends NostrEvent {
  appName: string;
  websiteUrl: string;
  repositoryUrl: string;
  description: string;
  appIconUrl: string;
  screenshotUrl: string;
  appTags: string[];
  authorNpub: string;
  isFeatured: boolean;
  isApproved: boolean;
  isHidden: boolean;
  isHomepage: boolean;
}

export function useAppSubmissions() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'app-submissions'],
    queryFn: async (): Promise<AppSubmission[]> => {
      // Get Soapbox team follow pack for auto-approval
      const teamPubkeys = new Set<string>();
      try {
        const decoded = nip19.decode(SOAPBOX_TEAM_NADDR);
        if (decoded.type === 'naddr') {
          const addrData = decoded.data;
          const teamEvents = await nostr.query([{
            kinds: [addrData.kind],
            authors: [addrData.pubkey],
            '#d': [addrData.identifier],
            limit: 1
          }], { signal: AbortSignal.timeout(3000) });

          if (teamEvents.length > 0) {
            const teamEvent = teamEvents[0];
            // Extract pubkeys from 'p' tags
            teamEvent.tags
              .filter(([name]) => name === 'p')
              .forEach(([, pubkey]) => {
                if (pubkey) teamPubkeys.add(pubkey);
              });
          }
        }
      } catch (error) {
        console.warn('Failed to fetch Soapbox team follow pack:', error);
      }

      // Get all app submissions (kind 31733)
      const submissionEvents = await nostr.query([{
        kinds: [APP_SUBMISSION_KIND],
        '#t': ['soapbox-app-submission'],
        limit: 1000
      }], { signal: AbortSignal.timeout(1000) });

      // Get featured app lists from moderators (NIP-51 kind 30267)
      const featuredLists = await nostr.query([{
        kinds: [30267],
        authors: [MODERATOR_HEX],
        '#d': ['soapbox-featured-apps'],
        limit: 10
      }], { signal: AbortSignal.timeout(1000) });

      // Get approved app lists from moderators (NIP-51 kind 30267)
      const approvedLists = await nostr.query([{
        kinds: [30267],
        authors: [MODERATOR_HEX],
        '#d': ['soapbox-approved-apps'],
        limit: 10
      }], { signal: AbortSignal.timeout(1000) });

      // Get homepage app lists from moderators (NIP-51 kind 30267)
      const homepageLists = await nostr.query([{
        kinds: [30267],
        authors: [MODERATOR_HEX],
        '#d': ['soapbox-homepage-apps'],
        limit: 10
      }], { signal: AbortSignal.timeout(1000) });

      // Get reporting events for hidden apps (NIP-56 kind 1984)
      const reportEvents = await nostr.query([{
        kinds: [1984],
        authors: [MODERATOR_HEX],
        limit: 1000
      }], { signal: AbortSignal.timeout(1000) });

      // Process submissions and apply moderation
      const submissions: AppSubmission[] = [];
      const submissionMap = new Map<string, NostrEvent>();

      // Group regular submissions by d-tag (identifier) to get latest version
      for (const event of submissionEvents) {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
        if (!dTag) continue;

        const existing = submissionMap.get(dTag);
        if (!existing || event.created_at > existing.created_at) {
          submissionMap.set(dTag, event);
        }
      }

      // Get the latest featured list
      const latestFeaturedList = featuredLists.reduce((latest, current) =>
        !latest || current.created_at > latest.created_at ? current : latest,
        null as NostrEvent | null
      );

      // Get the latest approved list
      const latestApprovedList = approvedLists.reduce((latest, current) =>
        !latest || current.created_at > latest.created_at ? current : latest,
        null as NostrEvent | null
      );

      // Get the latest homepage list
      const latestHomepageList = homepageLists.reduce((latest, current) =>
        !latest || current.created_at > latest.created_at ? current : latest,
        null as NostrEvent | null
      );

      // Extract featured app coordinates from the list
      const featuredAppCoords = new Set<string>();
      if (latestFeaturedList) {
        latestFeaturedList.tags
          .filter(tag => tag[0] === 'a')
          .forEach(tag => featuredAppCoords.add(tag[1]));
      }

      // Extract approved app coordinates from the list
      const approvedAppCoords = new Set<string>();
      if (latestApprovedList) {
        latestApprovedList.tags
          .filter(tag => tag[0] === 'a')
          .forEach(tag => approvedAppCoords.add(tag[1]));
      }

      // Extract homepage app coordinates from the list
      const homepageAppCoords = new Set<string>();
      if (latestHomepageList) {
        latestHomepageList.tags
          .filter(tag => tag[0] === 'a')
          .forEach(tag => homepageAppCoords.add(tag[1]));
      }

      // Get hidden app coordinates from reports
      const hiddenAppCoords = new Set<string>();
      const appReports = new Map<string, { hidden: number; unhidden: number }>();

      for (const report of reportEvents) {
        // Look for app coordinate in 'a' tags
        const aTag = report.tags.find(tag => tag[0] === 'a');
        if (!aTag || !aTag[1]) continue;

        const appCoord = aTag[1];
        const reportType = aTag[2];

        // Check if this is a moderation label
        const moderationLabel = report.tags.find(tag =>
          tag[0] === 'l' && tag[2] === 'soapbox.moderation'
        )?.[1];

        if (moderationLabel === 'hidden' && (reportType === 'spam' || reportType === 'other')) {
          if (!appReports.has(appCoord)) {
            appReports.set(appCoord, { hidden: 0, unhidden: 0 });
          }
          appReports.get(appCoord)!.hidden = Math.max(
            appReports.get(appCoord)!.hidden,
            report.created_at
          );
        } else if (moderationLabel === 'unhidden' && reportType === 'other') {
          if (!appReports.has(appCoord)) {
            appReports.set(appCoord, { hidden: 0, unhidden: 0 });
          }
          appReports.get(appCoord)!.unhidden = Math.max(
            appReports.get(appCoord)!.unhidden,
            report.created_at
          );
        }
      }

      // Determine which apps are currently hidden (latest action wins)
      for (const [appCoord, reports] of appReports) {
        if (reports.hidden > reports.unhidden) {
          hiddenAppCoords.add(appCoord);
        }
      }

      // Convert to AppSubmission objects
      for (const [dTag, event] of submissionMap) {
        try {
          const appName = event.tags.find(tag => tag[0] === 'title')?.[1] || '';
          const websiteUrl = event.tags.find(tag => tag[0] === 'website')?.[1] || '';
          const repositoryUrl = event.tags.find(tag => tag[0] === 'repository')?.[1] || '';
          const appIconUrl = event.tags.find(tag => tag[0] === 'icon')?.[1] || '';
          const screenshotUrl = event.tags.find(tag => tag[0] === 'screenshot')?.[1] || '';
          const authorNpub = event.tags.find(tag => tag[0] === 'author')?.[1] || event.pubkey;
          const appTags = event.tags.filter(tag => tag[0] === 'app-tag').map(tag => tag[1]);

          // Check if app is featured, approved, homepage, or hidden
          const appCoordinate = `${APP_SUBMISSION_KIND}:${event.pubkey}:${dTag}`;
          const isFeatured = featuredAppCoords.has(appCoordinate);
          const isHomepage = homepageAppCoords.has(appCoordinate);
          const isSubmittedByModerator = event.pubkey === MODERATOR_HEX;
          const isSubmittedByTeamMember = teamPubkeys.has(event.pubkey);
          const isApproved = approvedAppCoords.has(appCoordinate) || isFeatured || isSubmittedByModerator || isSubmittedByTeamMember;
          const isHidden = hiddenAppCoords.has(appCoordinate);

          submissions.push({
            ...event,
            appName,
            websiteUrl,
            repositoryUrl,
            description: event.content,
            appIconUrl,
            screenshotUrl,
            appTags: appTags,
            authorNpub,
            isFeatured,
            isApproved,
            isHidden,
            isHomepage
          });
        } catch (error) {
          console.warn('Failed to parse app submission:', error);
        }
      }

      return submissions;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

export function useUserAppSubmissions(userPubkey?: string) {
  const { data: allSubmissions, ...rest } = useAppSubmissions();

  const userSubmissions = allSubmissions?.filter(app => app.pubkey === userPubkey) || [];

  return {
    data: userSubmissions,
    ...rest
  };
}