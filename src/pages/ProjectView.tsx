import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ChatPane, type ChatPaneRef } from '@/components/Shakespeare/ChatPane';
import { PreviewPane } from '@/components/Shakespeare/PreviewPane';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ProjectInfoDialog } from '@/components/ProjectInfoDialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, Eye, Code, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionsMenu } from '@/components/ActionsMenu';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useKeepAlive } from '@/hooks/useKeepAlive';
import { GitStatusIndicator } from '@/components/GitStatusIndicator';
import { StarButton } from '@/components/StarButton';

import { useBuildProject } from '@/hooks/useBuildProject';
import { useIsProjectPreviewable } from '@/hooks/useIsProjectPreviewable';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'chat' | 'preview' | 'code'>('chat');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false);
  const projectsManager = useProjectsManager();
  const chatPaneRef = useRef<ChatPaneRef>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  const build = useBuildProject(projectId!);
  const { data: isPreviewable = false } = useIsProjectPreviewable(projectId!);

  // Keep-alive functionality to prevent tab throttling during AI processing
  const { updateMetadata } = useKeepAlive({
    enabled: isAILoading || build.isPending,
    title: 'Shakespeare',
    artist: project ? `Working on ${project.name}...` : 'Working...',
    artwork: [
      {
        src: '/favicon.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  });

  const loadProject = useCallback(async () => {
    if (!projectId) return;

    try {
      const projectData = await projectsManager.getProject(projectId);
      setProject(projectData);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectsManager]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Switch away from preview mode if project is not previewable
  useEffect(() => {
    if (mobileView === 'preview' && !isPreviewable) {
      setMobileView('code');
    }
    if (activeTab === 'preview' && !isPreviewable) {
      setActiveTab('code');
    }
  }, [isPreviewable, mobileView, activeTab]);

  const runBuild = async () => {
    if (build.isPending || !project) return;
    updateMetadata('Shakespeare', `Building ${project.name}...`);

    await build.mutateAsync(undefined, {
      onSuccess(result) {
        console.log('Project built:', result);
      },
      onError(error) {
        console.error('Build failed:', error);
      },
    });
  };

  const handleNewChat = () => {
    // Reset to chat view on mobile when starting new chat
    if (isMobile) {
      setMobileView('chat');
    }
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

  const handleProjectDeleted = async () => {
    setProject(null);
    navigate('/');
  };

  if (!project && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
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
        <header className="overflow-hidden border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-primary/10 supports-[backdrop-filter]:via-accent/5 supports-[backdrop-filter]:to-primary/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1">
              {project ? (
                <Button
                  variant="ghost"
                  className="block p-0 h-auto text-sm font-semibold truncate hover:bg-transparent hover:text-primary"
                  onClick={() => setIsProjectInfoOpen(true)}
                >
                  {project.name}
                </Button>
              ) : (
                <Skeleton className="h-5 w-32" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {project ? (
              <>
                <StarButton
                  projectId={project.id}
                  projectName={project.name}
                  className="h-8 w-8"
                />
                <ActionsMenu
                  projectId={project.id}
                  projectName={project.name}
                  onNewChat={handleNewChat}
                  isLoading={isAILoading}
                  isBuildLoading={build.isPending}
                  onFirstInteraction={handleFirstInteraction}
                />
              </>
            ) : (
              <>
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </>
            )}
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
            {/* Sidebar - positioned above the backdrop */}
            <div className="relative left-0 top-0 h-full w-80 max-w-[80vw] bg-background border-r shadow-lg z-10">
              <ProjectSidebar
                selectedProject={project}
                onSelectProject={(selectedProject) => {
                  setProject(selectedProject);
                  setIsSidebarVisible(false); // Always collapse sidebar on mobile navigation
                  if (selectedProject) {
                    setMobileView('chat'); // Switch to chat view when selecting a project
                    navigate(`/project/${selectedProject.id}`);
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
          {mobileView === 'chat' && (
            project ? (
              <ChatPane
                ref={chatPaneRef}
                projectId={project.id}
                onNewChat={handleNewChat}
                onBuild={runBuild}
                onFirstInteraction={handleFirstInteraction}
                onLoadingChange={handleAILoadingChange}
                isLoading={isAILoading}
                isBuildLoading={build.isPending}
              />
            ) : (
              <div className="h-full p-4 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            )
          )}
          {(mobileView === 'preview' || mobileView === 'code') && (
            project ? (
              <PreviewPane
                projectId={project.id}
                activeTab={mobileView}
                projectName={project.name}
                onFirstInteraction={handleFirstInteraction}
              />
            ) : (
              <div className="h-full p-4 space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-full w-full" />
              </div>
            )
          )}
        </div>

        <div className="border-t bg-gradient-to-r from-primary/5 via-background to-accent/5 backdrop-blur">
          <div className="flex">
            <Button
              variant={mobileView === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('chat')}
              className="flex-1 rounded-none"
              disabled={!project}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              {t('chat')}
            </Button>
            {isPreviewable && (
              <Button
                variant={mobileView === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMobileView('preview')}
                className="flex-1 rounded-none"
                disabled={!project}
              >
                <Eye className="h-4 w-4 mr-1" />
                {t('preview')}
              </Button>
            )}
            <Button
              variant={mobileView === 'code' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('code')}
              className="flex-1 rounded-none"
              disabled={!project}
            >
              <Code className="h-4 w-4 mr-1" />
              {t('code')}
              {mobileView !== 'code' && project && (
                <GitStatusIndicator projectId={project.id} className="ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Project Info Dialog */}
        {project && (
          <ProjectInfoDialog
            project={project}
            open={isProjectInfoOpen}
            onOpenChange={setIsProjectInfoOpen}
            onProjectDeleted={handleProjectDeleted}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      <div className={`w-80 border-r bg-sidebar duration-300 ${isSidebarVisible ? 'block' : 'hidden'}`}>
        <ProjectSidebar
          selectedProject={project}
          onSelectProject={(selectedProject) => {
            setProject(selectedProject);
            if (selectedProject) {
              navigate(`/project/${selectedProject.id}`);
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
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={40} minSize={25}>
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="h-12 px-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between h-12">
                    {/* Left side - Sidebar toggle (when collapsed) */}
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

                      {/* Project title */}
                      <div className="flex flex-1 min-w-0 truncate">
                        {project ? (
                          <Button
                            variant="ghost"
                            className="block p-0 h-auto font-semibold text-lg truncate hover:bg-transparent hover:text-primary"
                            onClick={() => setIsProjectInfoOpen(true)}
                          >
                            {project.name}
                          </Button>
                        ) : (
                          <Skeleton className="h-6 w-40" />
                        )}
                      </div>
                    </div>

                    {/* Right side - Star and Actions Menu */}
                    <div className="flex items-center gap-2">
                      {project ? (
                        <>
                          <StarButton
                            projectId={project.id}
                            projectName={project.name}
                            className="h-8 w-8"
                          />
                          <ActionsMenu
                            projectId={project.id}
                            projectName={project.name}
                            onNewChat={handleNewChat}
                            isLoading={isAILoading}
                            isBuildLoading={build.isPending}
                            onFirstInteraction={handleFirstInteraction}
                          />
                        </>
                      ) : (
                        <>
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chat Content */}
                <div className="flex-1 overflow-hidden">
                  {project ? (
                    <ChatPane
                      ref={chatPaneRef}
                      projectId={project.id}
                      onNewChat={handleNewChat}
                      onBuild={runBuild}
                      onFirstInteraction={handleFirstInteraction}
                      onLoadingChange={handleAILoadingChange}
                      isLoading={isAILoading}
                      isBuildLoading={build.isPending}
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
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle withHandle />

            {/* Preview/Code Panel */}
            <ResizablePanel defaultSize={60} minSize={30}>
              <div className="h-full">
                {project ? (
                  <PreviewPane
                    projectId={project.id}
                    activeTab={isPreviewable ? activeTab : 'code'}
                    onToggleView={isPreviewable ? () => setActiveTab(activeTab === 'preview' ? 'code' : 'preview') : undefined}
                    projectName={project.name}
                    onFirstInteraction={handleFirstInteraction}
                    isPreviewable={isPreviewable}
                  />
                ) : (
                  <div className="h-full p-4 space-y-4">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-full w-full" />
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Project Info Dialog */}
      {project && (
        <ProjectInfoDialog
          project={project}
          open={isProjectInfoOpen}
          onOpenChange={setIsProjectInfoOpen}
          onProjectDeleted={handleProjectDeleted}
        />
      )}
    </div>
  );
}
