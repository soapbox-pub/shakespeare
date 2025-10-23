import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileIcon,
  Plus,
  Minus,
  Edit,
  Loader2,
  SplitSquareHorizontal,
  ListTree,
  Copy,
  Check,
} from 'lucide-react';
import { useGit } from '@/hooks/useGit';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useFS } from '@/hooks/useFS';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface FileDiff {
  filepath: string;
  status: 'modified' | 'added' | 'deleted';
  hunks: DiffHunk[];
  oldContent?: string;
  newContent?: string;
}

interface DiffViewerProps {
  projectId: string;
  compareFrom?: string; // commit, branch, or 'HEAD'
  compareTo?: string; // commit, branch, or working directory
  filepath?: string; // If provided, show only this file
}

export function DiffViewer({ projectId, compareFrom = 'HEAD', compareTo, filepath }: DiffViewerProps) {
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');
  const [copiedHunk, setCopiedHunk] = useState<number | null>(null);

  const { git } = useGit();
  const { projectsPath } = useFSPaths();
  const { fs } = useFS();
  const { toast } = useToast();
  const projectPath = `${projectsPath}/${projectId}`;

  const getChangedFilesBetweenRefs = useCallback(async (from: string, to: string): Promise<string[]> => {
    // Get list of files from both refs and find differences
    const filesFrom = await git.listFiles({ dir: projectPath, ref: from });
    const filesTo = await git.listFiles({ dir: projectPath, ref: to });

    const changedFiles = new Set<string>();

    // Check files that exist in 'to'
    for (const file of filesTo) {
      try {
        const blobFrom = await git.readBlob({ dir: projectPath, oid: from, filepath: file });
        const blobTo = await git.readBlob({ dir: projectPath, oid: to, filepath: file });

        // Compare content
        if (Buffer.from(blobFrom.blob).toString() !== Buffer.from(blobTo.blob).toString()) {
          changedFiles.add(file);
        }
      } catch {
        // File exists in one but not the other
        changedFiles.add(file);
      }
    }

    // Check files that were deleted
    for (const file of filesFrom) {
      if (!filesTo.includes(file)) {
        changedFiles.add(file);
      }
    }

    return Array.from(changedFiles);
  }, [git, projectPath]);

  const generateFileDiff = useCallback(async (
    file: string,
    from: string,
    to?: string
  ): Promise<FileDiff | null> => {
    try {
      let oldContent = '';
      let newContent = '';
      let status: 'modified' | 'added' | 'deleted' = 'modified';

      // Get old content
      try {
        const blob = await git.readBlob({ dir: projectPath, oid: from, filepath: file });
        oldContent = Buffer.from(blob.blob).toString('utf-8');
      } catch {
        // File didn't exist in old version
        status = 'added';
      }

      // Get new content
      try {
        if (to) {
          const blob = await git.readBlob({ dir: projectPath, oid: to, filepath: file });
          newContent = Buffer.from(blob.blob).toString('utf-8');
        } else {
          // Working directory
          const content = await fs.readFile(`${projectPath}/${file}`, { encoding: 'utf8' });
          newContent = content;
        }
      } catch {
        // File doesn't exist in new version
        if (status !== 'added') {
          status = 'deleted';
        }
      }

      // Generate hunks
      const hunks = generateDiffHunks(oldContent, newContent);

      return {
        filepath: file,
        status,
        hunks,
        oldContent,
        newContent,
      };
    } catch (error) {
      console.error(`Error generating diff for ${file}:`, error);
      return null;
    }
  }, [git, projectPath, fs]);

  const generateDiffHunks = (oldContent: string, newContent: string): DiffHunk[] => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-by-line diff
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;

    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];

      if (oldLine === newLine) {
        // Context line
        if (currentHunk) {
          currentHunk.lines.push({
            type: 'context',
            content: oldLine || '',
            oldLineNumber: oldIndex + 1,
            newLineNumber: newIndex + 1,
          });
        }
        oldIndex++;
        newIndex++;
      } else {
        // Start a new hunk if needed
        if (!currentHunk) {
          currentHunk = {
            oldStart: oldIndex + 1,
            oldLines: 0,
            newStart: newIndex + 1,
            newLines: 0,
            lines: [],
          };

          // Add context before the change
          const contextStart = Math.max(0, oldIndex - 3);
          for (let i = contextStart; i < oldIndex; i++) {
            currentHunk.lines.push({
              type: 'context',
              content: oldLines[i] || '',
              oldLineNumber: i + 1,
              newLineNumber: i + 1,
            });
          }
        }

        // Determine if this is an addition, deletion, or modification
        if (oldIndex >= oldLines.length) {
          // Addition
          currentHunk.lines.push({
            type: 'add',
            content: newLine || '',
            newLineNumber: newIndex + 1,
          });
          currentHunk.newLines++;
          newIndex++;
        } else if (newIndex >= newLines.length) {
          // Deletion
          currentHunk.lines.push({
            type: 'delete',
            content: oldLine || '',
            oldLineNumber: oldIndex + 1,
          });
          currentHunk.oldLines++;
          oldIndex++;
        } else {
          // Changed line - show as delete + add
          currentHunk.lines.push({
            type: 'delete',
            content: oldLine || '',
            oldLineNumber: oldIndex + 1,
          });
          currentHunk.lines.push({
            type: 'add',
            content: newLine || '',
            newLineNumber: newIndex + 1,
          });
          currentHunk.oldLines++;
          currentHunk.newLines++;
          oldIndex++;
          newIndex++;
        }

        // Check if we should close this hunk
        const contextAfter = 3;
        let contextCount = 0;
        let tempOldIndex = oldIndex;
        let tempNewIndex = newIndex;

        while (
          contextCount < contextAfter &&
          tempOldIndex < oldLines.length &&
          tempNewIndex < newLines.length
        ) {
          if (oldLines[tempOldIndex] === newLines[tempNewIndex]) {
            currentHunk.lines.push({
              type: 'context',
              content: oldLines[tempOldIndex] || '',
              oldLineNumber: tempOldIndex + 1,
              newLineNumber: tempNewIndex + 1,
            });
            contextCount++;
            tempOldIndex++;
            tempNewIndex++;
          } else {
            break;
          }
        }

        if (contextCount >= contextAfter || tempOldIndex >= oldLines.length) {
          hunks.push(currentHunk);
          currentHunk = null;
          oldIndex = tempOldIndex;
          newIndex = tempNewIndex;
        }
      }
    }

    // Close any remaining hunk
    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  };

  const loadDiffs = useCallback(async () => {
    setIsLoading(true);
    try {
      let files: string[] = [];

      if (filepath) {
        files = [filepath];
      } else if (compareTo) {
        // Compare two commits/branches
        files = await getChangedFilesBetweenRefs(compareFrom, compareTo);
      } else {
        // Compare against working directory
        const statusMatrix = await git.statusMatrix({ dir: projectPath });
        files = statusMatrix
          .filter(([, head, workdir]) => head !== workdir)
          .map(([file]) => file);
      }

      const fileDiffs: FileDiff[] = [];

      for (const file of files) {
        try {
          const diff = await generateFileDiff(file, compareFrom, compareTo);
          if (diff) {
            fileDiffs.push(diff);
          }
        } catch (error) {
          console.warn(`Failed to generate diff for ${file}:`, error);
        }
      }

      setDiffs(fileDiffs);
      if (fileDiffs.length > 0 && !selectedFile) {
        setSelectedFile(fileDiffs[0].filepath);
      }
    } catch (error) {
      console.error('Failed to load diffs:', error);
      toast({
        title: 'Failed to load diffs',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [compareFrom, compareTo, filepath, git, projectPath, selectedFile, toast, getChangedFilesBetweenRefs, generateFileDiff]);

  useEffect(() => {
    loadDiffs();
  }, [projectId, compareFrom, compareTo, filepath, loadDiffs]);

  const copyHunkToClipboard = async (hunk: DiffHunk, index: number) => {
    const hunkText = hunk.lines.map(line => line.content).join('\n');
    await navigator.clipboard.writeText(hunkText);
    setCopiedHunk(index);
    setTimeout(() => setCopiedHunk(null), 2000);
  };

  const selectedDiff = diffs.find(d => d.filepath === selectedFile);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No changes to display</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* File list sidebar */}
      <div className="w-64 border-r">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Changed Files</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {diffs.length} file{diffs.length !== 1 ? 's' : ''} changed
          </p>
        </div>
        <ScrollArea className="h-[calc(100%-73px)]">
          <div className="p-2 space-y-1">
            {diffs.map((diff) => (
              <button
                key={diff.filepath}
                onClick={() => setSelectedFile(diff.filepath)}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                  selectedFile === diff.filepath
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50'
                )}
              >
                {diff.status === 'added' && <Plus className="h-4 w-4 text-green-600 shrink-0" />}
                {diff.status === 'deleted' && <Minus className="h-4 w-4 text-red-600 shrink-0" />}
                {diff.status === 'modified' && <Edit className="h-4 w-4 text-blue-600 shrink-0" />}
                <span className="font-mono text-sm truncate">{diff.filepath}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Diff content */}
      <div className="flex-1 flex flex-col">
        {selectedDiff && (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-sm font-medium">{selectedDiff.filepath}</h3>
                <Badge
                  variant="outline"
                  className={cn(
                    selectedDiff.status === 'added' && 'border-green-600 text-green-600',
                    selectedDiff.status === 'deleted' && 'border-red-600 text-red-600',
                    selectedDiff.status === 'modified' && 'border-blue-600 text-blue-600'
                  )}
                >
                  {selectedDiff.status}
                </Badge>
              </div>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'unified' | 'split')}>
                <TabsList>
                  <TabsTrigger value="split" className="gap-2">
                    <SplitSquareHorizontal className="h-4 w-4" />
                    Split
                  </TabsTrigger>
                  <TabsTrigger value="unified" className="gap-2">
                    <ListTree className="h-4 w-4" />
                    Unified
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Diff content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedDiff.hunks.map((hunk, hunkIndex) => (
                  <div key={hunkIndex} className="mb-6 border rounded-lg overflow-hidden">
                    {/* Hunk header */}
                    <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b">
                      <span className="font-mono text-xs text-muted-foreground">
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => copyHunkToClipboard(hunk, hunkIndex)}
                      >
                        {copiedHunk === hunkIndex ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Hunk lines */}
                    {viewMode === 'split' ? (
                      <SplitDiffView hunk={hunk} filepath={selectedDiff.filepath} />
                    ) : (
                      <UnifiedDiffView hunk={hunk} filepath={selectedDiff.filepath} />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}

function SplitDiffView({ hunk }: { hunk: DiffHunk; filepath: string }) {
  return (
    <div className="grid grid-cols-2 divide-x font-mono text-sm">
      {/* Old (left) side */}
      <div>
        {hunk.lines.map((line, i) => (
          line.type !== 'add' && (
            <div
              key={i}
              className={cn(
                'flex',
                line.type === 'delete' && 'bg-red-50 dark:bg-red-950/20'
              )}
            >
              <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right shrink-0">
                {line.oldLineNumber}
              </span>
              <pre className="px-2 py-1 flex-1 overflow-x-auto">
                <code
                  className={cn(line.type === 'delete' && 'text-red-700 dark:text-red-400')}
                  dangerouslySetInnerHTML={{ __html: line.content }}
                />
              </pre>
            </div>
          )
        ))}
      </div>

      {/* New (right) side */}
      <div>
        {hunk.lines.map((line, i) => (
          line.type !== 'delete' && (
            <div
              key={i}
              className={cn(
                'flex',
                line.type === 'add' && 'bg-green-50 dark:bg-green-950/20'
              )}
            >
              <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right shrink-0">
                {line.newLineNumber}
              </span>
              <pre className="px-2 py-1 flex-1 overflow-x-auto">
                <code
                  className={cn(line.type === 'add' && 'text-green-700 dark:text-green-400')}
                  dangerouslySetInnerHTML={{ __html: line.content }}
                />
              </pre>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function UnifiedDiffView({ hunk }: { hunk: DiffHunk; filepath: string }) {
  return (
    <div className="font-mono text-sm">
      {hunk.lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'flex',
            line.type === 'add' && 'bg-green-50 dark:bg-green-950/20',
            line.type === 'delete' && 'bg-red-50 dark:bg-red-950/20'
          )}
        >
          <span className="px-2 py-1 text-muted-foreground select-none w-12 text-right shrink-0">
            {line.oldLineNumber || line.newLineNumber}
          </span>
          <span className="px-2 py-1 select-none w-6 shrink-0">
            {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
          </span>
          <pre className="px-2 py-1 flex-1 overflow-x-auto">
            <code
              className={cn(
                line.type === 'add' && 'text-green-700 dark:text-green-400',
                line.type === 'delete' && 'text-red-700 dark:text-red-400'
              )}
              dangerouslySetInnerHTML={{ __html: line.content }}
            />
          </pre>
        </div>
      ))}
    </div>
  );
}
