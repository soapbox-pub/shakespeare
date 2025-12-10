import { useMemo } from 'react';
import { type NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
  /** When true, renders mentions and hashtags as styled text instead of clickable links */
  disableLinks?: boolean;
  /** When true, hides embedded note/event previews entirely */
  hideEmbeds?: boolean;
}

/** Parses content of text note events so that URLs and hashtags are linkified. */
export function NoteContent({
  event,
  className,
  disableLinks = false,
  hideEmbeds = false,
}: NoteContentProps) {
  // Process the content to render mentions, links, etc.
  const content = useMemo(() => {
    const text = event.content;

    // Regex to find URLs, Nostr references, and hashtags
    const regex = /(https?:\/\/[^\s]+)|nostr:(npub1|note1|nprofile1|nevent1)([023456789acdefghjklmnpqrstuvwxyz]+)|(#\w+)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, url, nostrPrefix, nostrData, hashtag] = match;
      const index = match.index;

      // Add text before this match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }

      if (url) {
        // Handle URLs - always render as links (but prevent click propagation when disableLinks)
        if (disableLinks) {
          parts.push(
            <span key={`url-${keyCounter++}`} className="text-blue-500">
              {url}
            </span>
          );
        } else {
          parts.push(
            <a
              key={`url-${keyCounter++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {url}
            </a>
          );
        }
      } else if (nostrPrefix && nostrData) {
        // Handle Nostr references
        try {
          const nostrId = `${nostrPrefix}${nostrData}`;
          const decoded = nip19.decode(nostrId);

          if (decoded.type === 'npub') {
            const pubkey = decoded.data;
            parts.push(
              <NostrMention key={`mention-${keyCounter++}`} pubkey={pubkey} disableLink={disableLinks} />
            );
          } else if (decoded.type === 'nprofile') {
            const pubkey = decoded.data.pubkey;
            parts.push(
              <NostrMention key={`mention-${keyCounter++}`} pubkey={pubkey} disableLink={disableLinks} />
            );
          } else if (decoded.type === 'nevent') {
            if (hideEmbeds) {
              // Skip embedded events entirely when hideEmbeds is true
            } else if (disableLinks) {
              parts.push(
                <NostrEventPreview key={`event-${keyCounter++}`} eventId={decoded.data.id} />
              );
            } else {
              parts.push(
                <NostrEventEmbed key={`event-${keyCounter++}`} eventId={decoded.data.id} />
              );
            }
          } else if (decoded.type === 'note') {
            if (hideEmbeds) {
              // Skip embedded notes entirely when hideEmbeds is true
            } else if (disableLinks) {
              parts.push(
                <NostrEventPreview key={`event-${keyCounter++}`} eventId={decoded.data} />
              );
            } else {
              parts.push(
                <NostrEventEmbed key={`event-${keyCounter++}`} eventId={decoded.data} />
              );
            }
          } else {
            // For other types, just show as styled text or link
            if (disableLinks) {
              parts.push(
                <span key={`nostr-${keyCounter++}`} className="text-blue-500">
                  {fullMatch}
                </span>
              );
            } else {
              parts.push(
                <Link
                  key={`nostr-${keyCounter++}`}
                  to={`/${nostrId}`}
                  className="text-blue-500 hover:underline"
                >
                  {fullMatch}
                </Link>
              );
            }
          }
        } catch {
          // If decoding fails, just render as text
          parts.push(fullMatch);
        }
      } else if (hashtag) {
        // Handle hashtags
        if (disableLinks) {
          parts.push(
            <span key={`hashtag-${keyCounter++}`} className="text-blue-500">
              {hashtag}
            </span>
          );
        } else {
          const tag = hashtag.slice(1); // Remove the #
          parts.push(
            <Link
              key={`hashtag-${keyCounter++}`}
              to={`/t/${tag}`}
              className="text-blue-500 hover:underline"
            >
              {hashtag}
            </Link>
          );
        }
      }

      lastIndex = index + fullMatch.length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // If no special content was found, just use the plain text
    if (parts.length === 0) {
      parts.push(text);
    }

    return parts;
  }, [event, disableLinks, hideEmbeds]);

  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {content.length > 0 ? content : event.content}
    </div>
  );
}

// Helper component to display user mentions with avatar
function NostrMention({ pubkey, disableLink = false }: { pubkey: string; disableLink?: boolean }) {
  const author = useAuthor(pubkey);
  const npub = nip19.npubEncode(pubkey);
  const hasRealName = !!author.data?.metadata?.name;
  const displayName = author.data?.metadata?.name ?? genUserName(pubkey);
  const picture = author.data?.metadata?.picture;

  const content = (
    <>
      <Avatar className="h-4 w-4 inline-block">
        <AvatarImage src={picture} alt={displayName} />
        <AvatarFallback className="text-[8px]">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      @{displayName}
    </>
  );

  if (disableLink) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium",
          hasRealName
            ? "text-blue-500"
            : "text-gray-500"
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      to={`/${npub}`}
      className={cn(
        "inline-flex items-center gap-1 font-medium hover:underline",
        hasRealName
          ? "text-blue-500"
          : "text-gray-500 hover:text-gray-700"
      )}
    >
      {content}
    </Link>
  );
}

// Helper component to display embedded events
function NostrEventEmbed({ eventId }: { eventId: string }) {
  const { nostr } = useNostr();

  const { data: event, isLoading } = useQuery({
    queryKey: ['nostr', 'event', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query([{ ids: [eventId], limit: 1 }], { signal });
      return event;
    },
    staleTime: 300000,
  });

  const author = useAuthor(event?.pubkey);
  const note1 = nip19.noteEncode(eventId);

  if (isLoading) {
    return (
      <div className="my-2 p-3 border rounded-lg bg-muted/30 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-3 bg-muted rounded w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <Link
        to={`/${note1}`}
        className="text-blue-500 hover:underline"
      >
        nostr:{note1.slice(0, 12)}...
      </Link>
    );
  }

  const displayName = author.data?.metadata?.name ?? genUserName(event.pubkey);
  const picture = author.data?.metadata?.picture;
  const contentPreview = event.content.length > 200
    ? event.content.slice(0, 200) + '...'
    : event.content;

  return (
    <Link
      to={`/${note1}`}
      className="block my-2 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors no-underline"
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-5 w-5">
          <AvatarImage src={picture} alt={displayName} />
          <AvatarFallback className="text-[10px]">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm text-foreground">{displayName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(event.created_at * 1000).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
        {contentPreview}
      </p>
    </Link>
  );
}

// Helper component to display embedded events without links (for use inside clickable cards)
function NostrEventPreview({ eventId }: { eventId: string }) {
  const { nostr } = useNostr();

  const { data: event, isLoading } = useQuery({
    queryKey: ['nostr', 'event', eventId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const [event] = await nostr.query([{ ids: [eventId], limit: 1 }], { signal });
      return event;
    },
    staleTime: 300000,
  });

  const author = useAuthor(event?.pubkey);

  if (isLoading) {
    return (
      <div className="my-2 p-3 border rounded-lg bg-muted/30 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-3 bg-muted rounded w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <span className="text-blue-500">
        [quoted note]
      </span>
    );
  }

  const displayName = author.data?.metadata?.name ?? genUserName(event.pubkey);
  const picture = author.data?.metadata?.picture;
  const contentPreview = event.content.length > 200
    ? event.content.slice(0, 200) + '...'
    : event.content;

  return (
    <div className="my-2 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-5 w-5">
          <AvatarImage src={picture} alt={displayName} />
          <AvatarFallback className="text-[10px]">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm text-foreground">{displayName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(event.created_at * 1000).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
        {contentPreview}
      </p>
    </div>
  );
}