import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

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
      <div className="min-h-dvh bg-background">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur pt-safe">
          <div className="h-12 px-4 py-3 flex items-center justify-between border-b">
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
            </div>
            {headerContent}
          </div>
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
            <div className="relative left-0 top-0 h-full w-72 max-w-[80vw] bg-background border-r shadow-lg z-10">
              <ProjectSidebar
                selectedProject={selectedProject}
                onSelectProject={(project) => {
                  setIsSidebarVisible(false); // Always collapse sidebar on mobile navigation
                  handleProjectSelect(project);
                }}
                onClose={() => setIsSidebarVisible(false)}
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
    <div className="h-dvh flex overflow-hidden bg-sidebar">
      {/* Sidebar, on the window's tint - show if showSidebar is true and sidebar is visible */}
      {showSidebar && isSidebarVisible && (
        <div className="w-72 flex-shrink-0">
          <ProjectSidebar
            selectedProject={selectedProject}
            onSelectProject={handleProjectSelect}
            className="h-full"
            onToggleSidebar={() => setIsSidebarVisible(false)}
          />
        </div>
      )}

      {/* Main Content Area, in a rounded panel */}
      <main
        className={cn(
          "relative flex-1 min-w-0 my-2 mr-2 overflow-y-auto rounded-2xl border bg-background shadow-panel",
          !(showSidebar && isSidebarVisible) && "ml-2",
        )}
      >
        {/* Show open button when sidebar is collapsed */}
        {showSidebar && !isSidebarVisible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarVisible(true)}
            className="absolute top-2 left-2 h-8 w-8 p-0 z-10 rounded-lg text-foreground/70 hover:text-foreground hover:bg-muted"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <div className="container mx-auto px-4 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
