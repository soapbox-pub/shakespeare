import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type { TextChat } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ChatPane, type ChatPaneRef } from '@/components/Shakespeare/ChatPane';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useIsMobile';

export function TextChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const [chat, setChat] = useState<TextChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);

  const projectsManager = useProjectsManager();
  const chatPaneRef = useRef<ChatPaneRef>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  const loadChat = useCallback(async () => {
    if (!chatId) return;

    try {
      const chatData = await projectsManager.getTextChat(chatId);
      setChat(chatData);
    } catch (error) {
      console.error('Failed to load chat:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, projectsManager]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const handleNewChat = () => {
    if (chatPaneRef.current) {
      chatPaneRef.current.startNewSession();
    }
  };

  const handleAILoadingChange = (loading: boolean) => {
    setIsAILoading(loading);
  };

  if (!chat && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Chat Not Found</h1>
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
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
                  <h1 className="text-sm font-semibold truncate">
                    {chat.name}
                  </h1>
                ) : (
                  <Skeleton className="h-5 w-32" />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarVisible && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div
              className="absolute inset-0"
              onClick={() => setIsSidebarVisible(false)}
            />
            <div className="relative left-0 top-0 h-full w-80 max-w-[80vw] bg-background border-r shadow-lg z-10">
              <ProjectSidebar
                selectedItem={chat}
                onSelectItem={(selectedItem) => {
                  setIsSidebarVisible(false);
                  if (selectedItem) {
                    if (selectedItem.type === 'project') {
                      navigate(`/project/${selectedItem.id}`);
                    } else {
                      navigate(`/chat/${selectedItem.id}`);
                    }
                  } else {
                    navigate('/');
                  }
                }}
                onClose={() => setIsSidebarVisible(false)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {chat ? (
            <ChatPane
              ref={chatPaneRef}
              projectId={chat.id}
              onNewChat={handleNewChat}
              onLoadingChange={handleAILoadingChange}
              isLoading={isAILoading}
              isTextChat={true}
            />
          ) : (
            <div className="h-full p-4 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      <div className={`w-80 border-r bg-sidebar duration-300 ${isSidebarVisible ? 'block' : 'hidden'}`}>
        <ProjectSidebar
          selectedItem={chat}
          onSelectItem={(selectedItem) => {
            if (selectedItem) {
              if (selectedItem.type === 'project') {
                navigate(`/project/${selectedItem.id}`);
              } else {
                navigate(`/chat/${selectedItem.id}`);
              }
            } else {
              navigate('/');
            }
          }}
          onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
          className="h-full"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Chat Header */}
            <div className="h-12 px-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between h-12">
                <div className="flex items-center gap-3 overflow-hidden">
                  {!isSidebarVisible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSidebarVisible(true)}
                      className="h-8 w-8 p-0"
                      aria-label="Open sidebar"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="flex flex-1 min-w-0 truncate">
                    {chat ? (
                      <h1 className="font-semibold text-lg truncate">
                        {chat.name}
                      </h1>
                    ) : (
                      <Skeleton className="h-6 w-40" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden">
              {chat ? (
                <ChatPane
                  ref={chatPaneRef}
                  projectId={chat.id}
                  onNewChat={handleNewChat}
                  onLoadingChange={handleAILoadingChange}
                  isLoading={isAILoading}
                  isTextChat={true}
                />
              ) : (
                <div className="h-full p-4 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
