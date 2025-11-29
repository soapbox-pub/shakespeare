import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch } from 'lucide-react';
import type { Repository } from '@/hooks/useUserRepositories';
import { useAuthor } from '@/hooks/useAuthor';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

interface RepositoryCardProps {
  repo: Repository;
}

export function RepositoryCard({ repo }: RepositoryCardProps) {
  const { data: authorData } = useAuthor(repo.pubkey);
  const navigate = useNavigate();

  const displayName = authorData?.metadata?.name || genUserName(repo.pubkey);
  const profileImage = authorData?.metadata?.picture;

  // Construct Nostr clone URL
  const nostrCloneUrl = `nostr://${nip19.npubEncode(repo.pubkey)}/${repo.repoId}`;

  const handleClone = () => {
    // Navigate to clone page with Nostr URL parameter
    navigate(`/clone?url=${encodeURIComponent(nostrCloneUrl)}`);
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
        <div className="mt-auto">
          <Button
            size="sm"
            className="w-full"
            onClick={handleClone}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            Clone
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
