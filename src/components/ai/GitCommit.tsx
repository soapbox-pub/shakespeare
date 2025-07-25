import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCommit as GitCommitIcon, CheckCircle, XCircle, GitBranch, Plus, Minus, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GitCommitProps {
  message: string;
  result?: string;
  isError?: boolean;
  className?: string;
}

export function GitCommit({
  message,
  result,
  isError = false,
  className
}: GitCommitProps) {
  // Parse the git commit result for useful information
  const parseCommitResult = (output: string) => {
    if (!output) return { summary: '', stats: null };

    // Extract commit hash
    const hashMatch = output.match(/🔗 Hash: ([a-f0-9]{7})/);
    const hash = hashMatch ? hashMatch[1] : null;

    // Extract branch
    const branchMatch = output.match(/🌿 Branch: (.+)/);
    const branch = branchMatch ? branchMatch[1] : null;

    // Extract file statistics
    const addedMatch = output.match(/• (\d+) files? added/);
    const modifiedMatch = output.match(/• (\d+) files? modified/);
    const deletedMatch = output.match(/• (\d+) files? deleted/);

    const stats = {
      added: addedMatch ? parseInt(addedMatch[1]) : 0,
      modified: modifiedMatch ? parseInt(modifiedMatch[1]) : 0,
      deleted: deletedMatch ? parseInt(deletedMatch[1]) : 0,
      hash,
      branch
    };

    // Extract summary line without hash
    const summaryMatch = output.match(/✅ Successfully committed (\d+) files?/);
    const summary = summaryMatch ? `Successfully committed ${summaryMatch[1]} file${summaryMatch[1] !== '1' ? 's' : ''}` : '';

    return { summary, stats };
  };

  const { summary, stats } = parseCommitResult(result || '');

  // Get first line of commit message
  const getFirstLine = (msg: string) => {
    return msg.split('\n')[0];
  };

  // Get emoji for commit type based on conventional commits
  const getCommitEmoji = (msg: string) => {
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.startsWith('feat')) return '✨';
    if (lowerMsg.startsWith('fix')) return '🐛';
    if (lowerMsg.startsWith('docs')) return '📚';
    if (lowerMsg.startsWith('style')) return '💄';
    if (lowerMsg.startsWith('refactor')) return '♻️';
    if (lowerMsg.startsWith('perf')) return '⚡';
    if (lowerMsg.startsWith('test')) return '✅';
    if (lowerMsg.startsWith('build')) return '👷';
    if (lowerMsg.startsWith('ci')) return '💚';
    if (lowerMsg.startsWith('chore')) return '🔧';
    if (lowerMsg.startsWith('revert')) return '⏪';
    if (lowerMsg.startsWith('merge')) return '🔀';
    if (lowerMsg.startsWith('init')) return '🎉';
    if (lowerMsg.startsWith('add')) return '➕';
    if (lowerMsg.startsWith('remove') || lowerMsg.startsWith('delete')) return '➖';
    if (lowerMsg.startsWith('update')) return '⬆️';
    return '📝';
  };

  const firstLine = getFirstLine(message);
  const commitEmoji = getCommitEmoji(message);

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <GitCommitIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">{commitEmoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-medium truncate">
                {firstLine}
              </div>
              <div className="text-xs text-muted-foreground">
                Git commit
                {stats?.branch && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {stats.branch}
                  </span>
                )}
                {stats?.hash && (
                  <span className="ml-2 font-mono">
                    {stats.hash}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result !== undefined ? (
              isError ? (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Committed
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                <GitCommitIcon className="h-3 w-3 mr-1" />
                Committing
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Full commit message - only show if multi-line */}
      {message.includes('\n') && (
        <CardContent className="pt-0">
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              View full commit message
            </summary>
            <div className="bg-muted/30 rounded-md overflow-hidden">
              <div className="p-3 max-h-80 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre text-foreground">
                  {message}
                </pre>
              </div>
            </div>
          </details>
        </CardContent>
      )}

      {result && (
        <CardContent className={cn("pt-0", message.includes('\n') ? "pt-3" : "")}>
          {/* Summary */}
          {summary && (
            <div className={cn(
              "mb-3 p-3 rounded-md text-sm font-medium",
              isError
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30"
            )}>
              {summary}
            </div>
          )}

          {/* File changes summary */}
          {stats && !isError && (stats.added > 0 || stats.modified > 0 || stats.deleted > 0) && (
            <div className="mb-3 flex items-center gap-4 text-sm">
              {stats.added > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Plus className="h-3 w-3" />
                  {stats.added} added
                </span>
              )}
              {stats.modified > 0 && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Edit className="h-3 w-3" />
                  {stats.modified} modified
                </span>
              )}
              {stats.deleted > 0 && (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <Minus className="h-3 w-3" />
                  {stats.deleted} deleted
                </span>
              )}
            </div>
          )}

          {/* Commit info footer */}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitCommitIcon className="h-3 w-3" />
              Git repository
            </span>
            {stats?.branch && (
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {stats.branch} branch
              </span>
            )}
            {!isError && (
              <span className="text-green-600 dark:text-green-400">
                Changes committed
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}