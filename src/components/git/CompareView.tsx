import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitCompare, Loader2, GitCommit, FileIcon } from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useToast } from '@/hooks/useToast';
import { DiffViewer } from './DiffViewer';
import { cn } from '@/lib/utils';

interface CompareViewProps {
  projectId: string;
}

interface CommitInfo {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
}

export function CompareView({ projectId }: CompareViewProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [baseRef, setBaseRef] = useState<string>('');
  const [compareRef, setCompareRef] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonStats, setComparisonStats] = useState<{
    ahead: number;
    behind: number;
    filesChanged: number;
  } | null>(null);

  const { git } = useGit();
  const { toast } = useToast();
  const projectPath = `/projects/${projectId}`;

  useEffect(() => {
    loadReferences();
  }, [projectId]);

  useEffect(() => {
    if (baseRef && compareRef && baseRef !== compareRef) {
      performComparison();
    }
  }, [baseRef, compareRef]);

  const loadReferences = async () => {
    setIsLoading(true);
    try {
      // Get all branches
      const localBranches = await git.listBranches({ dir: projectPath });
      setBranches(localBranches);

      // Set defaults
      const currentBranch = await git.currentBranch({ dir: projectPath }).catch(() => null);
      if (currentBranch) {
        setCompareRef(currentBranch);
      }

      // Set base to main/master if available
      if (localBranches.includes('main')) {
        setBaseRef('main');
      } else if (localBranches.includes('master')) {
        setBaseRef('master');
      } else if (localBranches.length > 0) {
        setBaseRef(localBranches[0]);
      }
    } catch (error) {
      console.error('Failed to load references:', error);
      toast({
        title: 'Failed to load branches',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const performComparison = async () => {
    if (!baseRef || !compareRef) return;

    setIsComparing(true);
    try {
      // Get commits in compareRef that are not in baseRef
      const baseCommits = await git.log({ dir: projectPath, ref: baseRef, depth: 100 });
      const compareCommits = await git.log({ dir: projectPath, ref: compareRef, depth: 100 });

      const baseCommitIds = new Set(baseCommits.map(c => c.oid));
      const compareCommitIds = new Set(compareCommits.map(c => c.oid));

      // Commits ahead (in compare but not in base)
      const aheadCommits = compareCommits.filter(c => !baseCommitIds.has(c.oid));

      // Commits behind (in base but not in compare)
      const behindCommits = baseCommits.filter(c => !compareCommitIds.has(c.oid));

      // Get list of changed files
      const baseFiles = await git.listFiles({ dir: projectPath, ref: baseRef });
      const compareFiles = await git.listFiles({ dir: projectPath, ref: compareRef });

      const changedFiles = new Set<string>();

      // Check files in compare ref
      for (const file of compareFiles) {
        try {
          const baseBlob = await git.readBlob({ dir: projectPath, oid: baseRef, filepath: file });
          const compareBlob = await git.readBlob({ dir: projectPath, oid: compareRef, filepath: file });

          if (Buffer.from(baseBlob.blob).toString() !== Buffer.from(compareBlob.blob).toString()) {
            changedFiles.add(file);
          }
        } catch {
          // File exists in one but not the other
          changedFiles.add(file);
        }
      }

      // Check for deleted files
      for (const file of baseFiles) {
        if (!compareFiles.includes(file)) {
          changedFiles.add(file);
        }
      }

      setComparisonStats({
        ahead: aheadCommits.length,
        behind: behindCommits.length,
        filesChanged: changedFiles.size,
      });

      // Set commit info for display
      const commitInfos: CommitInfo[] = aheadCommits.map(c => ({
        oid: c.oid,
        message: c.commit.message,
        author: c.commit.author.name,
        timestamp: c.commit.author.timestamp,
      }));

      setCommits(commitInfos);
    } catch (error) {
      console.error('Failed to compare:', error);
      toast({
        title: 'Comparison failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsComparing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comparison selectors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Branches
          </CardTitle>
          <CardDescription>
            Select two branches to compare changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Base Branch</label>
              <Select value={baseRef} onValueChange={setBaseRef}>
                <SelectTrigger>
                  <SelectValue placeholder="Select base branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6">
              <GitCompare className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Compare Branch</label>
              <Select value={compareRef} onValueChange={setCompareRef}>
                <SelectTrigger>
                  <SelectValue placeholder="Select compare branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison stats */}
          {comparisonStats && !isComparing && (
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {comparisonStats.ahead}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Commits Ahead
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {comparisonStats.behind}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Commits Behind
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {comparisonStats.filesChanged}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Files Changed
                </div>
              </div>
            </div>
          )}

          {isComparing && (
            <div className="mt-6 flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Comparing branches...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison results */}
      {baseRef && compareRef && baseRef !== compareRef && !isComparing && (
        <Tabs defaultValue="commits" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="commits" className="gap-2">
              <GitCommit className="h-4 w-4" />
              Commits ({commits.length})
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <FileIcon className="h-4 w-4" />
              Files ({comparisonStats?.filesChanged || 0})
            </TabsTrigger>
          </TabsList>

          {/* Commits tab */}
          <TabsContent value="commits" className="mt-6">
            {commits.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Commits in {compareRef} not in {baseRef}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {commits.map((commit) => (
                    <div
                      key={commit.oid}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <GitCommit className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {commit.message.split('\n')[0]}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{commit.author}</span>
                          <span>•</span>
                          <span>{formatDate(commit.timestamp)}</span>
                          <span>•</span>
                          <span className="font-mono">{commit.oid.substring(0, 7)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <GitCommit className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    No commits difference between branches
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Files tab */}
          <TabsContent value="files" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <DiffViewer
                  projectId={projectId}
                  compareFrom={baseRef}
                  compareTo={compareRef}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
