import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Filter, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAppSubmissions } from "@/hooks/useAppSubmissions";
import { AppShowcaseCard } from "@/components/AppShowcaseCard";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { nip19 } from 'nostr-tools';
import { shuffleArray } from "@/lib/utils";
import type { AppSubmission } from "@/hooks/useAppSubmissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { RelaySelector } from "@/components/RelaySelector";

export function AppShowcase() {
  const { user } = useCurrentUser();
  const { data: submissions = [], isLoading } = useAppSubmissions();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAllApps, setShowAllApps] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

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

  // Filter submissions
  const visibleSubmissions = submissions.filter(app => !app.isHidden);

  // Separate template apps from other apps
  const templateApps = useMemo(() =>
    shuffleArray(visibleSubmissions.filter(app => app.appTags.includes('Template'))),
    [visibleSubmissions]
  );
  const nonTemplateSubmissions = visibleSubmissions.filter(app => !app.appTags.includes('Template'));

  // Get Halloween Hackathon 2025 apps that are featured (for main showcase)
  const halloweenApps = useMemo(() =>
    shuffleArray(nonTemplateSubmissions.filter(app =>
      app.appTags.includes('Halloween Hackathon 2025') && app.isFeatured
    )),
    [nonTemplateSubmissions]
  );

  // Filter out Halloween Hackathon 2025 apps from other sections (unless featured, they go in Halloween section)
  const nonHalloweenSubmissions = nonTemplateSubmissions.filter(app =>
    !app.appTags.includes('Halloween Hackathon 2025')
  );

  // Shuffle featured and approved apps on each component mount/render for random display order
  const featuredApps = useMemo(() =>
    shuffleArray(nonHalloweenSubmissions.filter(app => app.isFeatured)),
    [nonHalloweenSubmissions]
  );
  const approvedApps = useMemo(() =>
    shuffleArray(nonHalloweenSubmissions.filter(app => app.isApproved && !app.isFeatured)),
    [nonHalloweenSubmissions]
  );

  // Apply search and tag filters
  const filterApps = (apps: AppSubmission[]) => {
    return apps.filter(app => {
      const matchesSearch = !searchTerm ||
        app.appName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.appTags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTag = !selectedTag || app.appTags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  };

  const filteredFeaturedApps = filterApps(featuredApps);
  const filteredHalloweenApps = filterApps(halloweenApps);
  const filteredApprovedApps = filterApps(approvedApps);
  const filteredTemplateApps = filterApps(templateApps);

  // Get all unique tags from approved and featured apps only (exclude pending, hidden, and template apps)
  const allTags = Array.from(new Set([...featuredApps, ...approvedApps].flatMap(app => app.appTags))).sort();

  // Get the most popular tags based on frequency (excluding Halloween Hackathon 2025 tag)
  const tagCounts = new Map<string, number>();
  [...featuredApps, ...approvedApps, ...templateApps].forEach(app => {
    app.appTags.forEach(tag => {
      // Don't include Halloween Hackathon 2025 in the tag filters
      if (tag !== 'Halloween Hackathon 2025') {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    });
  });

  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([tag]) => tag); // Extract just the tag names

  // Always show Template as the first tag if templates exist
  const topTags: string[] = [];
  if (templateApps.length > 0) {
    topTags.push('Template');
    // Remove Template from sortedTags to avoid duplication
    const templateIndex = sortedTags.indexOf('Template');
    if (templateIndex > -1) {
      sortedTags.splice(templateIndex, 1);
    }
  }

  // Show fewer tags on mobile, more on desktop
  const maxTagsToShow = isMobile ? 3 : 5;
  const availableSlots = maxTagsToShow - topTags.length;
  const popularTags = [...topTags, ...sortedTags.slice(0, availableSlots)];
  const remainingTags = sortedTags.slice(availableSlots);

  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
  };

  // Don't show showcase if no apps exist
  if (isLoading) {
    return (
      <div className="mt-16 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Community Showcase</h2>
          <p className="text-muted-foreground mb-6">
            Discover amazing applications built by our community
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-full flex flex-col">
              <Skeleton className="aspect-video rounded-t-lg" />
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
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
                  <Skeleton className="h-6 flex-1" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="mt-16 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Community Showcase</h2>
          <p className="text-muted-foreground mb-6">
            Discover amazing applications built by our community
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-12 px-8 text-center">
            <div className="max-w-sm mx-auto space-y-6">
              <p className="text-muted-foreground">
                No apps found. Try another relay?
              </p>
              <RelaySelector className="w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Community Showcase</h2>
        <p className="text-muted-foreground mb-6">
          Discover amazing applications built by our community
        </p>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search apps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tag Filters */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant={selectedTag ? "outline" : "default"}
                size="sm"
                onClick={() => handleTagSelect(null)}
                className="shrink-0"
              >
                All Tags
              </Button>
              {popularTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTagSelect(selectedTag === tag ? null : tag)}
                  className="shrink-0"
                >
                  {tag === 'Template' ? 'Templates' : tag}
                </Button>
              ))}

              {/* Show More Tags Button */}
              {remainingTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="shrink-0 text-primary hover:text-primary/80"
                >
                  {showAllTags ? 'Show Less' : `+${remainingTags.length} More`}
                </Button>
              )}
            </div>

            {/* Additional Tags (Collapsible) */}
            {showAllTags && remainingTags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 justify-center">
                {remainingTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTagSelect(selectedTag === tag ? null : tag)}
                    className="shrink-0"
                  >
                    {tag === 'Template' ? 'Templates' : tag}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apps Grid */}
      <div className="space-y-12">
        {/* When Template tag is selected, show only Templates */}
        {selectedTag === 'Template' ? (
          <>
            {/* Templates Section */}
            {filteredTemplateApps.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">📋</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Templates</h3>
                    <p className="text-sm text-gray-600">Ready-to-use templates to kickstart your project</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTemplateApps.slice(0, 6).map((app) => (
                    <AppShowcaseCard
                      key={app.id}
                      app={app}
                      showModerationControls={isModerator}
                      hideApprovalStatus={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Featured Apps */}
            {filteredFeaturedApps.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">⭐</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Featured Apps</h3>
                    <p className="text-sm text-gray-600">Handpicked applications showcasing the best of our community</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFeaturedApps.slice(0, 6).map((app) => (
                    <AppShowcaseCard
                      key={app.id}
                      app={app}
                      showModerationControls={isModerator}
                      hideApprovalStatus={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Halloween Hackathon 2025 Apps */}
            {filteredHalloweenApps.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">🎃</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Halloween Hackathon 2025</h3>
                    <p className="text-sm text-gray-600">Featured spooky creations from our Halloween hackathon</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHalloweenApps.slice(0, 6).map((app) => (
                    <AppShowcaseCard
                      key={app.id}
                      app={app}
                      showModerationControls={isModerator}
                      hideApprovalStatus={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Apps (Approved) - Collapsible */}
            {filteredApprovedApps.length > 0 && (
              <div>
                <Collapsible open={showAllApps} onOpenChange={setShowAllApps}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto mb-6 hover:bg-transparent">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm">📱</span>
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-gray-900">
                            All Apps ({filteredApprovedApps.length})
                          </h3>
                          <p className="text-sm text-gray-600">
                            {showAllApps ? 'Click to collapse' : 'Click to view all approved community apps'}
                          </p>
                        </div>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredApprovedApps.map((app) => (
                        <AppShowcaseCard
                          key={app.id}
                          app={app}
                          showModerationControls={isModerator}
                          hideApprovalStatus={true}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Templates Section */}
            {filteredTemplateApps.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">📋</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Templates</h3>
                    <p className="text-sm text-gray-600">Ready-to-use templates to kickstart your project</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTemplateApps.slice(0, 6).map((app) => (
                    <AppShowcaseCard
                      key={app.id}
                      app={app}
                      showModerationControls={isModerator}
                      hideApprovalStatus={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {(() => {
          if (selectedTag === 'Template') {
            return filteredTemplateApps.length === 0;
          }
          return filteredFeaturedApps.length === 0 && filteredHalloweenApps.length === 0 && filteredApprovedApps.length === 0 && filteredTemplateApps.length === 0;
        })() && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {selectedTag === 'Template' ? 'No templates found' : 'No apps found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || selectedTag
                ? "Try adjusting your search or filters"
                : "Be the first to submit an app to the showcase!"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}