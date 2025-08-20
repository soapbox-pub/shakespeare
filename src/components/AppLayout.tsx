import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { Button } from '@/components/ui/button';
import { Menu, Columns2 } from 'lucide-react';
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
  title = "Shakespeare",
  showSidebar = true,
  headerContent 
}: AppLayoutProps) {
  const [projects, setProjects] = useState<Project[]>([]);
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

  const loadProjects = useCallback(async () => {
    try {
      await projectsManager.init();
      const projectList = await projectsManager.getProjects();
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, [projectsManager]);

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
        <header className="border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {showSidebar && projects.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
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

        {/* Mobile Sidebar Overlay - only show if user has local projects and showSidebar is true */}
        {showSidebar && projects.length > 0 && isSidebarVisible && (
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
      {/* Fixed Sidebar - only show if user has created local projects and showSidebar is true */}
      {showSidebar && projects.length > 0 && (
        <div className={cn("w-80 border-r bg-sidebar transition-all duration-300", isSidebarVisible ? "block" : "hidden")}>
          <ProjectSidebar
            selectedProject={selectedProject}
            onSelectProject={handleProjectSelect}
            className="h-screen sticky top-0"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background">
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
          {/* Header - only show toggle button if user has local projects and showSidebar is true */}
          {!isSidebarVisible && showSidebar && projects.length > 0 && (
            <header className="border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur px-4 py-3 flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarVisible(true)}
                className="h-8 w-8 p-0"
                aria-label="Toggle sidebar"
              >
                <Columns2 className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent ml-4">
                {title}
              </h1>
              <div className="ml-auto">
                {headerContent}
              </div>
            </header>
          )}

          <div className="container mx-auto px-4 py-6 md:py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}