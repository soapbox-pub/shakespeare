import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import type { Repository } from '@/hooks/useUserRepositories';
import { useAuthor } from '@/hooks/useAuthor';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';
import { useNavigate } from 'react-router-dom';

interface RepositoryCardProps {
  repo: Repository;
}

export function RepositoryCard({ repo }: RepositoryCardProps) {
  const { data: authorData } = useAuthor(repo.pubkey);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const displayName = authorData?.metadata?.name || genUserName(repo.pubkey);
  const profileImage = authorData?.metadata?.picture;

  // Get the first clone URL (prefer HTTPS)
  const primaryCloneUrl = repo.cloneUrls.find(url => url.startsWith('https://')) || repo.cloneUrls[0];
  const webUrl = repo.webUrls[0];

  const handleCopyUrl = async (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast({
        title: 'Copied to clipboard',
        description: 'Repository URL copied successfully',
      });
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast({
        title: 'Failed to copy',
        description: 'Could not copy URL to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleClone = () => {
    if (primaryCloneUrl) {
      // Navigate to clone page with URL parameter
      navigate(`/clone?url=${encodeURIComponent(primaryCloneUrl)}`);
    }
  };

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer" onClick={handleClone}>
      <CardContent className="p-6 flex flex-col flex-1">
        {/* Header with name and author */}
        <div className="mb-4">
          <h3 className="font-semibold text-lg leading-tight mb-2 truncate">
            {repo.name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-4 w-4">
              {profileImage && (
                <AvatarImage src={profileImage} alt={displayName} />
              )}
              <AvatarFallback className="text-[8px]">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{displayName}</span>
          </div>
        </div>

        {/* Description */}
        {repo.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {repo.description}
          </p>
        )}

        {/* Tags */}
        {repo.repoTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {repo.repoTags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {repo.repoTags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{repo.repoTags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Personal fork badge */}
        {repo.isPersonalFork && (
          <div className="mb-4">
            <Badge variant="outline" className="text-xs">
              Personal Fork
            </Badge>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          {primaryCloneUrl && (
            <>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleClone}
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Clone
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="px-3"
                onClick={(e) => handleCopyUrl(primaryCloneUrl, e)}
              >
                {copiedUrl === primaryCloneUrl ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
          {webUrl && (
            <Button
              size="sm"
              variant="outline"
              className="px-3"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <a href={webUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
