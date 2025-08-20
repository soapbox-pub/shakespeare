import { ActionCard } from './shared/ActionCard';
import { GitCommit as GitCommitIcon, GitBranch, Plus, Minus, Edit } from 'lucide-react';

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

  const getCommitDescription = () => {
    let desc = 'Git commit';
    if (stats?.branch) {
      desc += ` • ${stats.branch} branch`;
    }
    if (stats?.hash) {
      desc += ` • ${stats.hash}`;
    }
    return desc;
  };

  return (
    <ActionCard
      title={firstLine}
      description={getCommitDescription()}
      icon={<span className="text-lg">{commitEmoji}</span>}
      result={result}
      isError={isError}
      className={className}
      showResult={false}
      runningIcon={<GitCommitIcon className="h-3 w-3" />}
      runningLabel="Committing"
      successLabel="Committed"
    >
      {/* Full commit message - only show if multi-line */}
      {message.includes('\n') && (
        <div className="mb-3">
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
        </div>
      )}

      {result && (
        <>
          {/* Summary */}
          {summary && (
            <div className="mb-3 p-3 rounded-md text-sm font-muted-foreground">
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
        </>
      )}
    </ActionCard>
  );
}