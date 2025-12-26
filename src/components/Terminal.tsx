import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellTool } from '@/lib/tools/ShellTool';
import { useFS } from '@/hooks/useFS';
import { useGit } from '@/hooks/useGit';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { stripAnsiCodes } from '@/lib/ansiToHtml';

interface TerminalProps {
  cwd: string;
  className?: string;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: Date;
}

export function Terminal({ cwd, className }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shellToolRef = useRef<ShellTool | null>(null);

  const { fs } = useFS();
  const { git } = useGit();
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  // Initialize ShellTool
  useEffect(() => {
    shellToolRef.current = new ShellTool(fs, cwd, git, config.corsProxy, user?.signer);

    // Add welcome message
    setLines([{
      id: Date.now().toString(),
      type: 'output',
      content: `Welcome to Shakespeare Terminal\nType 'help' to see available commands.`,
      timestamp: new Date()
    }]);
  }, [cwd, fs, git, config.corsProxy, user?.signer]);

  // Auto-scroll to bottom when new lines are added or execution state changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, isExecuting]);

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Refocus input after command execution
  useEffect(() => {
    if (!isExecuting && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExecuting]);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    const newLine: TerminalLine = {
      id: Date.now().toString() + Math.random(),
      type,
      content,
      timestamp: new Date()
    };
    setLines(prev => [...prev, newLine]);
  }, []);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    // Add command to history
    if (command.trim() && !commandHistory.includes(command.trim())) {
      setCommandHistory(prev => [...prev, command.trim()]);
    }
    setHistoryIndex(-1);

    // Add input line
    addLine('input', command);

    setIsExecuting(true);

    try {
      // Handle special clear command
      if (command.trim() === 'clear') {
        setLines([]);
        setIsExecuting(false);
        return;
      }

      // Check if running in Electron - use real shell
      if (window.electron?.shell) {
        // Use the provided cwd (Electron will expand ~ if present)
        const result = await window.electron.shell.exec(command, cwd);

        // Format output
        let output = '';

        if (result.stdout) {
          output += result.stdout;
        }

        if (result.stderr) {
          if (output) output += '\n';
          output += result.stderr;
        }

        // Add exit code info for non-zero exits
        if (result.exitCode !== 0) {
          if (output) output += '\n';
          output += `Exit code: ${result.exitCode}`;
        }

        if (output) {
          addLine('output', output);
        }
      } else {
        // Use virtual shell (browser mode)
        if (!shellToolRef.current) return;

        // Handle special help command
        if (command.trim() === 'help') {
          const availableCommands = shellToolRef.current.getAvailableCommands();
          const helpText = `Available commands:\n\n${availableCommands.map(cmd =>
            `${cmd.name.padEnd(12)} - ${cmd.description}`
          ).join('\n')}\n\nUse 'which <command>' for more details about a specific command.`;
          addLine('output', helpText);
        } else {
          const result = await shellToolRef.current.execute({ command });

          // Add output
          if (result.content && result.content.trim()) {
            addLine('output', result.content);
          }
        }
      }
    } catch (error) {
      addLine('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [addLine, commandHistory, cwd]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (currentInput.trim() && !isExecuting) {
      executeCommand(currentInput);
      setCurrentInput('');
    }
  }, [currentInput, isExecuting, executeCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentInput('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Basic tab completion could be added here
    }
  }, [commandHistory, historyIndex]);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  // Focus input when clicking anywhere in the terminal
  const handleTerminalClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={cn("h-full flex flex-col bg-black text-slate-300 font-mono text-sm", className)}>
      {/* Terminal Content */}
      <div className="flex-1 flex flex-col min-h-0" onClick={handleTerminalClick}>
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-2 space-y-1">
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "group relative",
                  line.type === 'input' && "text-white",
                  line.type === 'error' && "text-red-400",
                  line.type === 'output' && "text-slate-300"
                )}
              >
                <pre className="whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {line.type === 'input' ? (
                    <span className="text-purple-400 font-mono whitespace-nowrap">
                      ${' '}
                    </span>
                  ) : null}
                  {stripAnsiCodes(line.content)}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(stripAnsiCodes(line.content));
                  }}
                  className="absolute right-0 top-0 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white hover:bg-gray-700"
                >
                  <Copy className="h-2 w-2" />
                </Button>
              </div>
            ))}

            {/* Current Command Input - inline with content */}
            {!isExecuting && (
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-mono whitespace-nowrap">
                  $
                </span>
                <form onSubmit={handleSubmit} className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isExecuting}
                    className="w-full bg-transparent border-none outline-none text-white font-mono placeholder-gray-500 caret-white leading-relaxed"
                    placeholder=""
                    autoComplete="off"
                    spellCheck="false"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </form>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}