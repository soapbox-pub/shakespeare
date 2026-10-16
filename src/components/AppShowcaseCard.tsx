import React, { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, User } from 'lucide-react';
import type { AppSubmission } from '@/hooks/useAppSubmissions';
import { useAuthor } from '@/hooks/useAuthor';
import { nip19 } from 'nostr-tools';

interface AppShowcaseCardProps {
  app: AppSubmission;
}

export function AppShowcaseCard({ app }: AppShowcaseCardProps) {
  const [bannerError, setBannerError] = useState(false);
  const [iconError, setIconError] = useState(false);

  const { data: authorData } = useAuthor(app.pubkey);
  const authorNpub = nip19.npubEncode(app.pubkey);

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/20 h-full flex flex-col overflow-hidden">
      {/* Banner + overlapping icon */}
      <a
        href={app.websiteUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative"
      >
        {/* Banner */}
        <div className="aspect-[3/1] bg-muted overflow-hidden">
          {app.bannerUrl && !bannerError ? (
            <img
              src={app.bannerUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => setBannerError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/10 via-transparent to-primary/5" />
          )}
        </div>

        {/* Icon overlapping banner */}
        <div className="absolute bottom-0 translate-y-1/2 left-4">
          <div className="h-14 w-14 rounded-xl border-2 border-background shadow-md overflow-hidden bg-muted flex-shrink-0">
            {app.appIconUrl && !iconError ? (
              <img
                src={app.appIconUrl}
                alt={`${app.appName} icon`}
                className="w-full h-full object-cover"
                onError={() => setIconError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </a>

      <CardContent className="pt-10 px-4 pb-4 flex flex-col flex-1">
        <h3 className="text-base font-semibold text-foreground mb-1 truncate" title={app.appName}>
          {app.appName}
        </h3>

        {app.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{app.description}</p>
        )}

        {/* Author */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full overflow-hidden bg-muted flex-shrink-0">
            {authorData?.metadata?.picture ? (
              <img
                src={authorData.metadata.picture}
                alt={authorData.metadata.name || 'Author'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            by{' '}
            <a
              href={`https://ditto.pub/${authorNpub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors hover:underline"
            >
              {authorData?.metadata?.name || authorData?.metadata?.display_name || 'Anonymous'}
            </a>
          </span>
        </div>

        <div className="flex-1" />

        {/* Action Links */}
        <div className="flex items-center gap-2 mt-auto">
          {app.repositoryUrl && (
            <Link to={`/clone?url=${encodeURIComponent(app.repositoryUrl)}`} className="flex-1">
              <img src="/badge.svg" alt="Edit with Shakespeare" className="h-6 hover:opacity-80 transition-opacity" />
            </Link>
          )}
          {app.websiteUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={app.websiteUrl} target="_blank" rel="noopener noreferrer" title="Visit app">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
