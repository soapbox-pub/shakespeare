import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { Button } from '@/components/ui/button';
import { Menu, Columns2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface AppLayoutProps {
  children: React.ReactNode;
  selectedProject?: Project | null;
  title?: string;
  showSidebar?: boolean;
  headerContent?: React.ReactNode;
}

export function AppLayout({
  children,
  selectedProject = null,
  title = "Shakespeare",
  showSidebar = true,
  headerContent
}: AppLayoutProps) {
  const [_projects, setProjects] = useState<Project[]>([]);
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);

  // Track if we've set the initial state based on projects
  const [hasSetInitialState, setHasSetInitialState] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      await projectsManager.init();
      const projectList = await projectsManager.getProjects();
      setProjects(projectList);

      // Set initial sidebar state based on projects and device type
      if (!hasSetInitialState && !isMobile) {
        // On desktop, show sidebar if there are projects
        setIsSidebarVisible(projectList.length > 0);
        setHasSetInitialState(true);
      } else if (!hasSetInitialState && isMobile) {
        // On mobile, always start hidden
        setIsSidebarVisible(false);
        setHasSetInitialState(true);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      if (!hasSetInitialState) {
        setHasSetInitialState(true);
      }
    }
  }, [projectsManager, hasSetInitialState, isMobile]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectSelect = (project: Project | null) => {
    if (project) {
      setIsSidebarVisible(false); // Collapse sidebar on mobile navigation
      navigate(`/project/${project.id}`);
    } else {
      navigate('/');
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-primary/5 to-accent/5">
        {/* Mobile Header */}
        <header className="h-12 border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {showSidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                aria-label="Toggle sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {title}
            </h1>
          </div>
          {headerContent}
        </header>

        {/* Mobile Sidebar Overlay - show if showSidebar is true and sidebar is visible */}
        {showSidebar && isSidebarVisible && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            {/* Backdrop - only covers the area not occupied by the sidebar */}
            <div
              className="absolute inset-0"
              onClick={() => setIsSidebarVisible(false)}
            />
            {/* Sidebar - positioned above the backdrop */}
            <div className="relative left-0 top-0 h-full w-80 max-w-[80vw] bg-background border-r shadow-lg z-10">
              <ProjectSidebar
                selectedProject={selectedProject}
                onSelectProject={(project) => {
                  setIsSidebarVisible(false); // Always collapse sidebar on mobile navigation
                  handleProjectSelect(project);
                }}
              />
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-6 md:py-8">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Fixed Sidebar - show if showSidebar is true and sidebar is visible */}
      {showSidebar && isSidebarVisible && (
        <div className="w-80 border-r bg-sidebar transition-all duration-300">
          <ProjectSidebar
            selectedProject={selectedProject}
            onSelectProject={handleProjectSelect}
            className="h-screen sticky top-0"
            showCollapseButton={true}
            onCollapse={() => setIsSidebarVisible(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background">
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 relative">
          {/* Toggle Button - only show when sidebar is collapsed */}
          {showSidebar && !isSidebarVisible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarVisible(true)}
              className="absolute top-2 left-4 h-8 w-8 p-0 z-10 bg-transparent backdrop-blur-sm hover:bg-transparent text-foreground/70 hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          )}

          <div className="container mx-auto px-4 py-6 md:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}