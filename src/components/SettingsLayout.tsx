import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, Columns2, Settings as SettingsIcon, Bot, GitBranch } from 'lucide-react';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useIsMobile } from '@/hooks/useIsMobile';
import { type Project } from '@/lib/ProjectsManager';
import { useCallback } from 'react';

interface SettingsItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const settingsItems: SettingsItem[] = [
  {
    id: 'ai',
    title: 'AI Settings',
    description: 'Configure AI providers and API keys',
    icon: Bot,
    href: '/settings/ai',
  },
  {
    id: 'git',
    title: 'Git Settings',
    description: 'Configure Git credentials for HTTP authentication',
    icon: GitBranch,
    href: '/settings/git',
  },
];

export function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const projectsManager = useProjectsManager();

  const [_projects, setProjects] = useState<Project[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    // On mobile, always start hidden
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return false;
    }
    return false; // Default to closed initially
  });
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

  // Get current settings page
  const currentPath = location.pathname;
  const currentSettingsId = settingsItems.find(item => item.href === currentPath)?.id;

  if (isMobile) {
    return (
      <div className="min-h-dvh bg-white">
        {/* Mobile Header */}
        <header className="h-12 border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">Settings</h1>
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
                selectedProject={null}
                onSelectProject={(project) => {
                  setIsSidebarVisible(false);
                  handleProjectSelect(project);
                }}
              />
            </div>
          </div>
        )}

        <Outlet />
      </div>
    );
  }

  // Desktop 3-column layout
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Column - Projects Sidebar (optionally hidden) */}
      {isSidebarVisible && (
        <div className="w-80 border-r bg-sidebar">
          <ProjectSidebar
            selectedProject={null}
            onSelectProject={handleProjectSelect}
            className="h-screen sticky top-0"
          />
        </div>
      )}

      {/* Middle Column - Settings Navigation */}
      <div className="w-96 border-r bg-white flex flex-col">
        {/* Header with toggle button */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="h-8 w-8 p-0"
              aria-label="Toggle sidebar"
            >
              {isSidebarVisible ? <Columns2 className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              Settings
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your application settings and preferences
          </p>
        </div>

        {/* Settings Navigation */}
        <div className="flex-1 p-4">
          <div className="space-y-2">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentSettingsId === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.href)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                        {item.title}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column - Settings Content */}
      <div className="flex-1 bg-white">
        <div className="max-w-4xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}