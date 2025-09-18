import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, Bot, GitBranch, Database, Wifi } from 'lucide-react';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useIsMobile } from '@/hooks/useIsMobile';
import { type Project } from '@/lib/ProjectsManager';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';

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
  {
    id: 'nostr',
    title: 'Nostr Settings',
    description: 'Configure relay connections and Nostr preferences',
    icon: Wifi,
    href: '/settings/nostr',
  },
  {
    id: 'data',
    title: 'Data',
    description: 'Export files and manage local data',
    icon: Database,
    href: '/settings/data',
  },
];

export function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const projectsManager = useProjectsManager();

  const [_projects, setProjects] = useState<Project[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);
  const [hasSetInitialState, setHasSetInitialState] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      await projectsManager.init();
      const projectList = await projectsManager.getProjects();
      setProjects(projectList);

      // Set initial sidebar state based on projects and device type
      if (!hasSetInitialState && !isMobile) {
        // On desktop, show sidebar if there are projects
        setIsSidebarVisible(true);
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
                onClose={() => setIsSidebarVisible(false)}
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
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Left Column - Projects Sidebar (optionally hidden) */}
      {isSidebarVisible && (
        <div className="w-80 border-r bg-sidebar flex-shrink-0">
          <ProjectSidebar
            selectedProject={null}
            onSelectProject={handleProjectSelect}
            className="h-full"
            onToggleSidebar={() => setIsSidebarVisible(false)}
          />
        </div>
      )}

      {/* Middle Column - Settings Navigation */}
      <div className="w-96 border-r bg-white flex flex-col flex-shrink-0">
        {/* Header with toggle button */}
        <div className="h-12 px-4 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
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
            <h1 className="text-xl font-bold flex items-center gap-2">
              Settings
            </h1>
          </div>
        </div>

        {/* Settings Navigation - Scrollable */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="space-y-2">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentSettingsId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href)}
                    className={cn('w-full text-left p-3 rounded-lg transition-colors border border-transparent', {
                      'bg-primary/10 border border-primary/20': isActive,
                      'hover:bg-muted/50': !isActive,
                    })}
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
        </ScrollArea>
      </div>

      {/* Right Column - Settings Content - Scrollable */}
      <ScrollArea className="flex-1 bg-white">
        <div className="max-w-4xl">
          <Outlet />
        </div>
      </ScrollArea>
    </div>
  );
}