import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, CheckCircle, XCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShellCommandProps {
  command: string;
  result?: string;
  isError?: boolean;
  className?: string;
}

export function ShellCommand({ command, result, isError = false, className }: ShellCommandProps) {
  // Parse command to get useful information
  const parseCommand = (cmd: string) => {
    const parts = cmd.trim().split(' ');
    const baseCommand = parts[0];

    // Get command info
    const getCommandInfo = (baseCmd: string) => {
      switch (baseCmd) {
        case 'ls':
        case 'dir': return { icon: '📁', description: 'List directory contents' };
        case 'cd': return { icon: '📂', description: 'Change directory' };
        case 'mkdir': return { icon: '📁', description: 'Create directory' };
        case 'rm':
        case 'rmdir':
        case 'del': return { icon: '🗑️', description: 'Remove files/directories' };
        case 'cp':
        case 'copy': return { icon: '📋', description: 'Copy files' };
        case 'mv':
        case 'move': return { icon: '📦', description: 'Move/rename files' };
        case 'cat':
        case 'type': return { icon: '📄', description: 'Display file contents' };
        case 'grep':
        case 'findstr': return { icon: '🔍', description: 'Search text patterns' };
        case 'find': return { icon: '🔍', description: 'Find files and directories' };
        case 'chmod': return { icon: '🔐', description: 'Change file permissions' };
        case 'git': return { icon: '🌿', description: 'Git version control' };
        case 'npm':
        case 'yarn':
        case 'pnpm': return { icon: '📦', description: 'Package manager' };
        case 'node': return { icon: '🟢', description: 'Run Node.js' };
        case 'python':
        case 'python3': return { icon: '🐍', description: 'Run Python' };
        case 'curl':
        case 'wget': return { icon: '🌐', description: 'Download from web' };
        case 'ps': return { icon: '⚙️', description: 'List running processes' };
        case 'kill': return { icon: '⚡', description: 'Terminate processes' };
        case 'echo': return { icon: '💬', description: 'Display text' };
        case 'pwd': return { icon: '📍', description: 'Show current directory' };
        case 'whoami': return { icon: '👤', description: 'Show current user' };
        case 'which':
        case 'where': return { icon: '🔍', description: 'Locate command' };
        default: return { icon: '⚡', description: 'Execute command' };
      }
    };

    return {
      baseCommand,
      fullCommand: cmd,
      ...getCommandInfo(baseCommand)
    };
  };

  const commandInfo = parseCommand(command);

  // Parse output for useful information
  const parseOutput = (output: string) => {
    if (!output) return { summary: '', details: output };

    const lines = output.split('\n').filter(line => line.trim());

    // Look for common patterns
    if (commandInfo.baseCommand === 'ls' || commandInfo.baseCommand === 'dir') {
      const fileCount = lines.length;
      return {
        summary: `Found ${fileCount} item${fileCount !== 1 ? 's' : ''}`,
        details: output
      };
    }

    if (commandInfo.baseCommand === 'git') {
      const gitSubcommand = command.split(' ')[1];
      if (gitSubcommand === 'status') {
        return {
          summary: lines.find(line => line.includes('nothing to commit') || line.includes('Changes') || line.includes('Untracked')) || 'Git status checked',
          details: output
        };
      }
      if (gitSubcommand === 'log') {
        const commitCount = (output.match(/commit /g) || []).length;
        return {
          summary: `Showing ${commitCount} commit${commitCount !== 1 ? 's' : ''}`,
          details: output
        };
      }
    }

    if (commandInfo.baseCommand === 'npm' || commandInfo.baseCommand === 'yarn') {
      if (output.includes('added') || output.includes('installed')) {
        return {
          summary: 'Package installation completed',
          details: output
        };
      }
    }

    // Default: use first meaningful line or last line
    const meaningfulLines = lines.filter(line =>
      !line.startsWith('#') &&
      !line.startsWith('//') &&
      line.length > 0
    );

    return {
      summary: meaningfulLines[meaningfulLines.length - 1] || 'Command executed',
      details: output
    };
  };

  const { summary, details } = parseOutput(result || '');

  return (
    <Card className={cn("mt-2", isError ? "border-destructive/50" : "border-muted", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">{commandInfo.icon}</span>
            </div>
            <div>
              <div className="font-mono text-sm font-medium">$ {commandInfo.fullCommand}</div>
              <div className="text-xs text-muted-foreground">{commandInfo.description}</div>
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
                  Success
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                <Play className="h-3 w-3 mr-1" />
                Running
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {result && (
        <CardContent className="pt-0">
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

          {/* Full output */}
          {details && details.trim() && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                View command output
              </summary>
              <div className="bg-muted/30 rounded-md overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground border-b border-muted/50">
                  Terminal Output
                </div>
                <div className="p-3 max-h-80 overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre text-muted-foreground">
                    {details}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {/* Command stats */}
          {!isError && details && (
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {details.split('\n').length} line{details.split('\n').length !== 1 ? 's' : ''} output
              </span>
              {commandInfo.baseCommand === 'ls' && (
                <span>
                  {details.split('\n').filter(line => line.trim()).length} items listed
                </span>
              )}
              {(commandInfo.baseCommand === 'git' && command.includes('log')) && (
                <span>
                  {(details.match(/commit /g) || []).length} commits shown
                </span>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}