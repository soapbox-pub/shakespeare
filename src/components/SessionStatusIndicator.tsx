import { useState, useEffect } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Activity, Clock, Loader2, MessageSquare, X } from 'lucide-react';
import type { SessionState } from '@/lib/SessionManager';
import { cn } from '@/lib/utils';

interface SessionStatusIndicatorProps {
  className?: string;
  currentProjectId?: string;
}

/**
 * Component that shows the status of all active AI sessions
 */
export function SessionStatusIndicator({ className, currentProjectId }: SessionStatusIndicatorProps) {
  const sessionManager = useSessionManager();
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Update sessions when they change
  useEffect(() => {
    const updateSessions = () => {
      setSessions(sessionManager.getAllSessions());
    };

    // Initial load
    updateSessions();

    // Subscribe to session changes
    sessionManager.on('sessionCreated', updateSessions);
    sessionManager.on('sessionUpdated', updateSessions);
    sessionManager.on('sessionDeleted', updateSessions);

    return () => {
      sessionManager.off('sessionCreated', updateSessions);
      sessionManager.off('sessionUpdated', updateSessions);
      sessionManager.off('sessionDeleted', updateSessions);
    };
  }, [sessionManager]);

  const activeSessions = sessions.filter(session => session.isLoading);
  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return null;
  }

  const handleStopSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sessionManager.stopGeneration(sessionId);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sessionManager.deleteSession(sessionId);
  };

  const formatLastActivity = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 gap-1 text-xs",
            activeSessions.length > 0 && "text-blue-600 dark:text-blue-400",
            className
          )}
        >
          {activeSessions.length > 0 ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Activity className="h-3 w-3" />
          )}
          <span>{totalSessions}</span>
          {activeSessions.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-xs">
              {activeSessions.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">AI Sessions</h4>
          <p className="text-xs text-muted-foreground">
            {totalSessions} active session{totalSessions !== 1 ? 's' : ''}
            {activeSessions.length > 0 && ` (${activeSessions.length} running)`}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "p-3 border-b last:border-b-0 hover:bg-muted/50",
                session.projectId === currentProjectId && "bg-primary/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-sm truncate">
                      {session.projectName}
                    </h5>
                    {session.isLoading && (
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span>{session.messages.length} messages</span>
                    <Clock className="h-3 w-3 ml-1" />
                    <span>{formatLastActivity(session.lastActivity)}</span>
                  </div>
                  {session.streamingMessage?.content && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {session.streamingMessage.content.slice(0, 50)}...
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {session.isLoading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleStopSession(session.id, e)}
                      title="Stop generation"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    title="Delete session"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}