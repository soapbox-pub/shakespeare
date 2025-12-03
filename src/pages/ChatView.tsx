import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type Chat } from '@/lib/ChatsManager';
import { useChatsManager } from '@/hooks/useChatsManager';
import { ChatPane, type ChatPaneRef } from '@/components/Shakespeare/ChatPane';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Menu } from 'lucide-react';
import { ActionsMenu } from '@/components/ActionsMenu';
import { useIsMobile } from '@/hooks/useIsMobile';

export function ChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const [chat, setChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);

  const chatsManager = useChatsManager();
  const chatPaneRef = useRef<ChatPaneRef>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  const loadChat = useCallback(async () => {
    if (!chatId) return;

    try {
      const chatData = await chatsManager.getChat(chatId);
      setChat(chatData);
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, chatsManager]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const handleNewChat = () => {
    // Call the ChatPane's startNewSession function
    if (chatPaneRef.current) {
      chatPaneRef.current.startNewSession();
    }
  };

  const handleAILoadingChange = (loading: boolean) => {
    setIsAILoading(loading);
  };

  // Handle first user interaction to enable audio context
  const handleFirstInteraction = () => {
    // This will be handled automatically by the useKeepAlive hook
    // when isAILoading becomes true after user interaction
  };

  const handleChatDeleted = () => {
    // Navigate to home page after chat is deleted
    navigate('/');
  };

  // Chat not found - show in app layout with sidebar
  if (!chat && !isLoading) {
    if (isMobile) {
      return (
        <div className="h-dvh flex flex-col bg-background">
          <header className="pt-safe bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur">
            <div className="h-12 border-b px-4 py-3 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Mobile Sidebar Overlay */}
          {isSidebarVisible && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
              <div
                className="absolute inset-0"
                onClick={() => setIsSidebarVisible(false)}
              />
              <div className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar">
                <ProjectSidebar
                  selectedProject={null}
                  onSelectProject={() => {}}
                  onClose={() => setIsSidebarVisible(false)}
                />
              </div>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Chat Not Found</h1>
              <p className="text-muted-foreground mb-4">
                This chat may have been deleted or doesn't exist.
              </p>
              <Button onClick={() => navigate('/')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Desktop layout for not found
    return (
      <div className="h-screen flex bg-background">
        {/* Fixed Sidebar */}
        {isSidebarVisible && (
          <div className="w-72 border-r bg-sidebar">
            <ProjectSidebar
              selectedProject={null}
              onSelectProject={() => {}}
              className="h-screen sticky top-0"
              onToggleSidebar={() => setIsSidebarVisible(false)}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 relative">
            {/* Menu button when sidebar is collapsed */}
            {!isSidebarVisible && (
              <div className="absolute top-4 left-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarVisible(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Chat Not Found</h1>
              <p className="text-muted-foreground mb-4">
                This chat may have been deleted or doesn't exist.
              </p>
              <Button onClick={() => navigate('/')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-dvh flex flex-col bg-background">
        <header className="pt-safe bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur">
          <div className="h-12 border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="flex min-w-0 flex-1">
                {chat ? (
                  <div className="text-sm font-semibold truncate">
                    {chat.name}
                  </div>
                ) : (
                  <Skeleton className="h-5 w-32" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {chat ? (
                <ActionsMenu
                  projectId={chat.id}
                  projectName={chat.name}
                  onNewChat={handleNewChat}
                  isLoading={isAILoading}
                  isBuildLoading={false}
                  onFirstInteraction={handleFirstInteraction}
                  isChat={true}
                  onChatDeleted={handleChatDeleted}
                />
              ) : (
                <Skeleton className="h-8 w-8 rounded" />
              )}
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarVisible && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            {/* Backdrop - only covers the area not occupied by the sidebar */}
            <div
              className="absolute inset-0"
              onClick={() => setIsSidebarVisible(false)}
            />

            {/* Sidebar */}
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar">
              <ProjectSidebar
                selectedProject={null}
                onSelectProject={() => {}}
                onClose={() => setIsSidebarVisible(false)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {chat && (
            <ChatPane
              ref={chatPaneRef}
              projectId={chat.id}
              onNewChat={handleNewChat}
              onFirstInteraction={handleFirstInteraction}
              onLoadingChange={handleAILoadingChange}
              isLoading={isAILoading}
              isChat={true}
            />
          )}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      {isSidebarVisible && (
        <div className="w-72 border-r bg-sidebar">
          <ProjectSidebar
            selectedProject={null}
            onSelectProject={() => {}}
            className="h-screen sticky top-0"
            onToggleSidebar={() => setIsSidebarVisible(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <header className="pt-safe bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur">
          <div className="h-12 border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              {!isSidebarVisible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarVisible(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              <div className="flex min-w-0 flex-1">
                {chat ? (
                  <div className="text-sm font-semibold truncate">
                    {chat.name}
                  </div>
                ) : (
                  <Skeleton className="h-5 w-32" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {chat ? (
                <ActionsMenu
                  projectId={chat.id}
                  projectName={chat.name}
                  onNewChat={handleNewChat}
                  isLoading={isAILoading}
                  isBuildLoading={false}
                  onFirstInteraction={handleFirstInteraction}
                  isChat={true}
                  onChatDeleted={handleChatDeleted}
                />
              ) : (
                <Skeleton className="h-8 w-8 rounded" />
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {chat && (
            <ChatPane
              ref={chatPaneRef}
              projectId={chat.id}
              onNewChat={handleNewChat}
              onFirstInteraction={handleFirstInteraction}
              onLoadingChange={handleAILoadingChange}
              isLoading={isAILoading}
              isChat={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
