import { ActionCard } from './shared/ActionCard';
import { Terminal } from 'lucide-react';

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
    <ActionCard
      title={`$ ${commandInfo.fullCommand}`}
      description={commandInfo.description}
      icon={<span className="text-lg">{commandInfo.icon}</span>}
      result={result}
      isError={isError}
      className={className}
      runningIcon={<Terminal className="h-3 w-3" />}
      runningLabel="Executing"
    >
      {result && (
        <>
          {/* Summary */}
          {summary && (
            <div className="mb-3 p-3 rounded-md text-sm font-muted-foreground">
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
        </>
      )}
    </ActionCard>
  );
}