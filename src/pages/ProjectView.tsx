import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ChatPane, type ChatPaneRef } from '@/components/Shakespeare/ChatPane';
import { PreviewPane } from '@/components/Shakespeare/PreviewPane';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ProjectDetailsDialog } from '@/components/ProjectDetailsDialog';
import { DeleteProjectDialog } from '@/components/DeleteProjectDialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, Eye, Code, Menu, Loader2, MessageSquarePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useIsMobile';
import { ProjectTitleMenu } from '@/components/ProjectTitleMenu';
import { GitHistoryDialog } from '@/components/ai/GitHistoryDialog';
import { DuplicateProjectDialog } from '@/components/DuplicateProjectDialog';
import { GitStatusIndicator } from '@/components/GitStatusIndicator';
import { GitSyncButton } from '@/components/git-sync';
import { DeployButton } from '@/components/deploy/DeployButton';
import { useBuildProject } from '@/hooks/useBuildProject';
import { useIsProjectPreviewable } from '@/hooks/useIsProjectPreviewable';
import { useConsoleError } from '@/hooks/useConsoleError';
import { useAutoBuild } from '@/hooks/useAutoBuild';
import { useToast } from '@/hooks/useToast';
import { useFSPaths } from '@/hooks/useFSPaths';
import { useGitSync } from '@/hooks/useGitSync';
import { useGitAutosync } from '@/hooks/useGitAutosync';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useProjectSessionStatus } from '@/hooks/useProjectSessionStatus';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'chat' | 'preview' | 'code'>('chat');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isProjectDetailsOpen, setIsProjectDetailsOpen] = useState(false);
  const [gitHistoryOpen, setGitHistoryOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use console error state from provider
  const { consoleError, dismissConsoleError, clearErrors } = useConsoleError();

  const projectsManager = useProjectsManager();
  const chatPaneRef = useRef<ChatPaneRef>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { projectsPath } = useFSPaths();
  const queryClient = useQueryClient();

  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  const build = useBuildProject(projectId!);
  const { data: isPreviewable = false } = useIsProjectPreviewable(projectId!);
  const { hasRunningSessions } = useProjectSessionStatus(projectId || '');

  // Automatically sync with remote to keep git status updated
  useGitSync(projectId ? `${projectsPath}/${projectId}` : undefined);

  // Load autosync state at the top level to prevent jarring toggle shifts
  useGitAutosync(projectId ? `${projectsPath}/${projectId}` : undefined);

  // Enable auto-build for previewable projects
  useAutoBuild({
    projectId: projectId!,
    enabled: isPreviewable,
    debounceMs: 2000,
  });

  const loadProject = useCallback(async () => {
    if (!projectId) return;

    try {
      const projectData = await projectsManager.getProject(projectId);
      setProject(projectData);
      // Clear console messages and error state when switching projects
      clearErrors();
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectsManager, clearErrors]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Reset view state when projectId changes
  useEffect(() => {
    if (projectId) {
      // Reset to preview tab if the new project is previewable, otherwise code
      setActiveTab(isPreviewable ? 'preview' : 'code');
      // Reset mobile view to chat when switching projects
      setMobileView('chat');
    }
  }, [projectId, isPreviewable]);

  // Switch away from preview mode if project is not previewable
  useEffect(() => {
    if (mobileView === 'preview' && !isPreviewable) {
      setMobileView('code');
    }
    if (activeTab === 'preview' && !isPreviewable) {
      setActiveTab('code');
    }
  }, [isPreviewable, mobileView, activeTab]);

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

  const handleDismissConsoleError = () => {
    dismissConsoleError();
  };

  const handleProjectDeleted = async () => {
    setProject(null);
    navigate('/');
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    setIsDeleting(true);
    try {
      await projectsManager.deleteProject(project.id);

      // Invalidate the projects query to update the sidebar
      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast({
        title: "Project deleted",
        description: `"${project.name}" has been permanently deleted.`,
      });

      // Close the dialog first
      setDeleteDialogOpen(false);

      // Navigate back to home and notify parent
      navigate('/');
      handleProjectDeleted();
    } catch (error) {
      toast({
        title: "Failed to delete project",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isAnyLoading = isAILoading || build.isPending;

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
        <header className="pt-safe bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur">
          <div className="h-12 border-b p-2 flex items-center justify-between">
            <div className="flex items-center space-x-2 overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              >
                <Menu className="size-5" />
              </Button>
              <div className="flex min-w-0 flex-1">
                {project ? (
                  <ProjectTitleMenu
                    projectId={project.id}
                    projectName={project.name}
                    onGitHistory={() => setGitHistoryOpen(true)}
                    onDuplicate={() => setDuplicateDialogOpen(true)}
                    onDelete={() => setDeleteDialogOpen(true)}
                    onProjectDetails={() => setIsProjectDetailsOpen(true)}
                    isAnyLoading={isAnyLoading || isDeleting}
                    className="text-base"
                  />
                ) : (
                  <Skeleton className="h-5 w-32" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 px-3">
              {project ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNewChat}
                    disabled={isAILoading}
                    className="size-8 p-0 group"
                    title={t('newChat')}
                  >
                    <MessageSquarePlus className="size-5 group-hover:text-foreground text-muted-foreground" />
                  </Button>
                  <GitSyncButton
                    projectId={project.id}
                    className="h-8 w-8"
                  />
                  <DeployButton
                    projectId={project.id}
                    projectName={project.name}
                    disabled={isAnyLoading}
                  />
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </>
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
            {/* Sidebar - positioned above the backdrop */}
            <div className="relative left-0 top-0 h-full w-72 max-w-[80vw] bg-background border-r shadow-lg z-10">
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
                onFirstInteraction={handleFirstInteraction}
                onLoadingChange={handleAILoadingChange}
                isLoading={isAILoading}
                isBuildLoading={build.isPending}
                consoleError={consoleError}
                onDismissConsoleError={handleDismissConsoleError}
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
              />
            ) : (
              <div className="h-full p-4 space-y-4">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-full w-full" />
              </div>
            )
          )}
        </div>

        <div className="border-t bg-gradient-to-r from-primary/5 via-background to-accent/5 backdrop-blur pb-safe">
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileView('chat')}
              className={cn("flex-1 rounded-none mobile-nav-button text-muted-foreground", { "text-foreground": mobileView === 'chat' })}
              disabled={!project}
            >
              {project && hasRunningSessions ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin text-blue-600 dark:text-blue-400" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-1" />
              )}
              {t('chat')}
            </Button>
            {isPreviewable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileView('preview')}
                className={cn("flex-1 rounded-none mobile-nav-button text-muted-foreground", { "text-foreground": mobileView === 'preview' })}
                disabled={!project}
              >
                <Eye className="h-4 w-4 mr-1" />
                {t('preview')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileView('code')}
              className={cn("flex-1 rounded-none mobile-nav-button text-muted-foreground", { "text-foreground": mobileView === 'code' })}
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

        {/* Dialogs */}
        {project && (
          <>
            <ProjectDetailsDialog
              project={project}
              open={isProjectDetailsOpen}
              onOpenChange={setIsProjectDetailsOpen}
              onProjectDeleted={handleProjectDeleted}
            />
            <GitHistoryDialog
              projectId={project.id}
              open={gitHistoryOpen}
              onOpenChange={setGitHistoryOpen}
            />
            <DuplicateProjectDialog
              projectId={project.id}
              projectName={project.name}
              open={duplicateDialogOpen}
              onOpenChange={setDuplicateDialogOpen}
            />
            <DeleteProjectDialog
              projectName={project.name}
              onDelete={handleDeleteProject}
              isDeleting={isDeleting}
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      <div className={`w-72 border-r bg-sidebar duration-300 ${isSidebarVisible ? 'block' : 'hidden'}`}>
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
            <ResizablePanel defaultSize={35} minSize={25}>
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
                          <ProjectTitleMenu
                            projectId={project.id}
                            projectName={project.name}
                            onGitHistory={() => setGitHistoryOpen(true)}
                            onDuplicate={() => setDuplicateDialogOpen(true)}
                            onDelete={() => setDeleteDialogOpen(true)}
                            onProjectDetails={() => setIsProjectDetailsOpen(true)}
                            isAnyLoading={isAnyLoading || isDeleting}
                            className="text-lg"
                          />
                        ) : (
                          <Skeleton className="h-6 w-40" />
                        )}
                      </div>
                    </div>

                    {/* Right side - New Chat, Deploy and Sync buttons */}
                    <div className="flex items-center gap-2">
                      {project ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleNewChat}
                            disabled={isAILoading}
                            className="size-8 p-0 group"
                            title={t('newChat')}
                          >
                            <MessageSquarePlus className="size-5 group-hover:text-foreground text-muted-foreground" />
                          </Button>
                          <GitSyncButton
                            projectId={project.id}
                            className="h-8 w-8"
                          />
                          <DeployButton
                            projectId={project.id}
                            projectName={project.name}
                            disabled={isAnyLoading}
                          />
                        </>
                      ) : (
                        <>
                          <Skeleton className="h-8 w-8 rounded" />
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
                      onFirstInteraction={handleFirstInteraction}
                      onLoadingChange={handleAILoadingChange}
                      isLoading={isAILoading}
                      isBuildLoading={build.isPending}
                      consoleError={consoleError}
                      onDismissConsoleError={handleDismissConsoleError}
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
            <ResizablePanel defaultSize={65} minSize={30}>
              <div className="h-full">
                {project ? (
                  <PreviewPane
                    projectId={project.id}
                    activeTab={isPreviewable ? activeTab : 'code'}
                    onToggleView={isPreviewable ? () => setActiveTab(activeTab === 'preview' ? 'code' : 'preview') : undefined}
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

      {/* Dialogs */}
      {project && (
        <>
          <ProjectDetailsDialog
            project={project}
            open={isProjectDetailsOpen}
            onOpenChange={setIsProjectDetailsOpen}
            onProjectDeleted={handleProjectDeleted}
          />
          <GitHistoryDialog
            projectId={project.id}
            open={gitHistoryOpen}
            onOpenChange={setGitHistoryOpen}
          />
          <DuplicateProjectDialog
            projectId={project.id}
            projectName={project.name}
            open={duplicateDialogOpen}
            onOpenChange={setDuplicateDialogOpen}
          />
          <DeleteProjectDialog
            projectName={project.name}
            onDelete={handleDeleteProject}
            isDeleting={isDeleting}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          />
        </>
      )}
    </div>
  );
}
