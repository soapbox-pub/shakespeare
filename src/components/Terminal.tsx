import { useState, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { X, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellTool } from '@/lib/tools/ShellTool';
import { useFS } from '@/hooks/useFS';
import { useGit } from '@/hooks/useGit';

interface TerminalProps {
  projectId: string;
  onClose?: () => void;
  className?: string;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: Date;
}

export function Terminal({ projectId, onClose, className }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState(`/projects/${projectId}`);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shellToolRef = useRef<ShellTool | null>(null);

  const { fs } = useFS();
  const { git } = useGit();

  // Initialize ShellTool
  useEffect(() => {
    shellToolRef.current = new ShellTool(fs, `/projects/${projectId}`, git);

    // Add welcome message
    setLines([{
      id: Date.now().toString(),
      type: 'output',
      content: `Welcome to Shakespeare Terminal\nProject: ${projectId}\nType 'help' to see available commands.`,
      timestamp: new Date()
    }]);
  }, [projectId, fs, git]);

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
    if (!shellToolRef.current || !command.trim()) return;

    // Add command to history
    if (command.trim() && !commandHistory.includes(command.trim())) {
      setCommandHistory(prev => [...prev, command.trim()]);
    }
    setHistoryIndex(-1);

    // Add input line
    addLine('input', `$ ${command}`);

    setIsExecuting(true);

    try {
      // Handle special help command
      if (command.trim().toLowerCase() === 'help') {
        const availableCommands = shellToolRef.current.getAvailableCommands();
        const helpText = `Available commands:\n\n${availableCommands.map(cmd =>
          `${cmd.name.padEnd(12)} - ${cmd.description}`
        ).join('\n')}\n\nUse 'which <command>' for more details about a specific command.`;
        addLine('output', helpText);
      } else {
        const result = await shellToolRef.current.execute({ command });

        // Update current working directory
        const newCwd = shellToolRef.current.getCurrentWorkingDirectory();
        setCurrentWorkingDirectory(newCwd);

        // Add output
        if (result && result.trim()) {
          addLine('output', result);
        }
      }
    } catch (error) {
      addLine('error', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  }, [addLine, commandHistory]);

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

  const clearTerminal = useCallback(() => {
    setLines([]);
  }, []);

  const getPrompt = () => {
    const relativePath = currentWorkingDirectory.replace(`/projects/${projectId}`, '') || '/';
    return `${projectId}:${relativePath}$`;
  };

  // Focus input when clicking anywhere in the terminal
  const handleTerminalClick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={cn("h-full flex flex-col bg-black text-green-400 font-mono text-sm", className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-300 text-xs">Terminal - {projectId}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTerminal}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 flex flex-col min-h-0" onClick={handleTerminalClick}>
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="p-2 space-y-1">
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "group relative",
                  line.type === 'input' && "text-blue-400",
                  line.type === 'error' && "text-red-400",
                  line.type === 'output' && "text-green-400"
                )}
              >
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                  {line.content}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(line.content);
                  }}
                  className="absolute right-0 top-0 h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white hover:bg-gray-700"
                >
                  <Copy className="h-2 w-2" />
                </Button>
              </div>
            ))}
            {isExecuting && (
              <div className="text-yellow-400 text-xs">
                <span className="animate-pulse">Executing...</span>
              </div>
            )}

            {/* Current Command Input - inline with content */}
            {!isExecuting && (
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-xs font-mono whitespace-nowrap">
                  {getPrompt()}
                </span>
                <form onSubmit={handleSubmit} className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isExecuting}
                    className="w-full bg-transparent border-none outline-none text-green-400 font-mono text-xs placeholder-gray-500 caret-green-400"
                    placeholder=""
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {/* Blinking cursor when input is empty */}
                  {!currentInput && (
                    <span className="absolute left-0 top-0 text-green-400 font-mono text-xs animate-pulse">
                      _
                    </span>
                  )}
                </form>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}