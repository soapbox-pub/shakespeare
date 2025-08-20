import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ChatPane } from '@/components/Shakespeare/ChatPane';
import { PreviewPane } from '@/components/Shakespeare/PreviewPane';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Eye, Code, Menu, Columns2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AISettingsDialog } from '@/components/ai/AISettingsDialog';
import { useIsMobile } from '@/hooks/useIsMobile';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  const handleBuildComplete = useCallback((projectId: string) => {
    setActiveTab('preview');
    // Dispatch custom event to notify PreviewPane that build is complete
    const event = new CustomEvent('buildComplete', {
      detail: { projectId }
    });
    window.dispatchEvent(event);
    console.log('Dispatched buildComplete event for project:', projectId);
  }, []);
  const [mobileView, setMobileView] = useState<'chat' | 'preview' | 'code'>('chat');
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    // Check if we're on mobile immediately to set correct initial state
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // Desktop starts open, mobile starts closed
    }
    return false; // Default to closed for SSR
  });

  const loadProject = useCallback(async () => {
    if (!projectId) return;

    try {
      const projectData = await projectsManager.getProject(projectId);
      setProject(projectData);
    } catch (_error) {
      console.error('Failed to load project:', _error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectsManager]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
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
        <header className="border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-primary/10 supports-[backdrop-filter]:via-accent/5 supports-[backdrop-filter]:to-primary/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold truncate">{project.name}</h1>
            </div>
          </div>

          <AISettingsDialog />
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
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {mobileView === 'chat' && (
            <ChatPane
              projectId={project.id}
              projectName={project.name}
              onBuildComplete={handleBuildComplete}
            />
          )}
          {(mobileView === 'preview' || mobileView === 'code') && (
            <PreviewPane
              projectId={project.id}
              activeTab={mobileView}
            />
          )}
        </div>

        <div className="border-t bg-gradient-to-r from-primary/5 via-background to-accent/5 backdrop-blur">
          <div className="flex">
            <Button
              variant={mobileView === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('chat')}
              className="flex-1 rounded-none"
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Chat
            </Button>
            <Button
              variant={mobileView === 'preview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('preview')}
              className="flex-1 rounded-none"
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button
              variant={mobileView === 'code' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMobileView('code')}
              className="flex-1 rounded-none"
            >
              <Code className="h-4 w-4 mr-1" />
              Code
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      <div className={`w-80 border-r bg-sidebar transition-all duration-300 ${isSidebarVisible ? 'block' : 'hidden'}`}>
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
          className="h-full"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="px-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between h-12">
                    {/* Left side - Sidebar toggle */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                        className="h-8 w-8 p-0"
                        aria-label="Toggle sidebar"
                      >
                        <Columns2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Center - Project title */}
                    <div className="flex-1 min-w-0 ml-2 px-4">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <h2 className="font-semibold text-lg truncate">
                          {project.name}
                        </h2>
                      </div>
                    </div>

                    {/* Right side - AI Settings */}
                    <div className="flex items-center gap-2">
                      <AISettingsDialog />
                    </div>
                  </div>
                </div>

                {/* Chat Content */}
                <div className="flex-1 overflow-hidden">
                  <ChatPane
                    projectId={project.id}
                    projectName={project.name}
                    onBuildComplete={handleBuildComplete}
                  />
                </div>
              </div>
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle withHandle />

            {/* Preview/Code Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Preview Header */}
                <div className="px-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between h-12">
                    <div className="flex space-x-2">
                      <Button
                        variant={activeTab === 'preview' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('preview')}
                      >
                        Preview
                      </Button>
                      <Button
                        variant={activeTab === 'code' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('code')}
                      >
                        Code
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-hidden">
                  <PreviewPane
                    projectId={project.id}
                    activeTab={activeTab}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
