import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, GitBranch, Loader2, ChevronDown, Star, Columns2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoginArea } from '@/components/auth/LoginArea';
import { useProjects } from '@/hooks/useProjects';
import { useProjectSessionStatus } from '@/hooks/useProjectSessionStatus';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Project } from '@/lib/ProjectsManager';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onSelect: (project: Project) => void;
  isFavorite?: boolean;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ project, isSelected, onSelect, isFavorite }) => {
  const navigate = useNavigate();
  const { hasRunningSessions } = useProjectSessionStatus(project.id);

  const handleClick = () => {
    onSelect(project);
    navigate(`/project/${project.id}`);
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10",
        isSelected && "bg-gradient-to-r from-primary/15 to-accent/15 shadow-sm"
      )}
    >
      <div className="w-full px-3 py-2 text-left text-sidebar-foreground">
        <button
          onClick={handleClick}
          className="absolute inset-0"
        />
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {hasRunningSessions ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <Folder className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex justify-between gap-2 flex-1 min-w-0">
            <div className="min-w-0 flex-1 flex items-center">
              <h3 className="font-medium text-sm truncate">
                {project.name}
              </h3>
            </div>

            {/* Star indicator - only shown when favorited */}
            {isFavorite && (
              <div className="flex-shrink-0 relative -mr-1 pointer-events-none">
                <div className="flex items-center justify-center">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

ProjectItem.displayName = 'ProjectItem';

interface ProjectSidebarProps {
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  className?: string;
  onToggleSidebar?: () => void;
  onClose?: () => void;
}

export function ProjectSidebar({
  selectedProject,
  onSelectProject,
  className,
  onToggleSidebar,
  onClose
}: ProjectSidebarProps) {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading, error } = useProjects();
  const [favorites] = useLocalStorage<string[]>('project-favorites', []);
  const isMobile = useIsMobile();

  const navigate = useNavigate();

  // Custom navigate function that closes sidebar on mobile
  const navigateAndClose = (path: string) => {
    navigate(path);
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleNewProject = () => {
    onSelectProject(null);
    navigateAndClose('/');
  };

  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else if (onClose && isMobile) {
      onClose();
    }
  };

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  }, [favorites, queryClient]);

  if (error) {
    console.error('Failed to load projects:', error);
  }

  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-b from-sidebar to-sidebar/95", className)}>
      {/* Header with Logo */}
      <div className="flex px-4 h-12 border-b border-sidebar-border bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => navigateAndClose('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
          >
            <span className="text-2xl">🎭</span>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Shakespeare
            </h1>
          </button>
          {(onToggleSidebar || (onClose && isMobile)) && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-primary/10 -mr-2"
                onClick={handleToggleSidebar}
                aria-label={(onClose && isMobile) ? "Close sidebar" : "Collapse sidebar"}
              >
                {(onClose && isMobile) ? (
                  <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                ) : (
                  <Columns2 className="h-4 w-4 text-primary/60 hover:text-primary" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="mb-2">
            <div className="relative rounded-md bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-200">
              <div className="flex">
                <button
                  onClick={handleNewProject}
                  className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-primary-foreground rounded-l-md hover:bg-white/10 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </button>
                <div className="w-px bg-white/20" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-2 py-2 text-primary-foreground hover:bg-white/10 rounded-r-md transition-colors">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => navigateAndClose('/clone')}
                      className="flex items-center gap-2 w-full"
                    >
                      <GitBranch className="h-4 w-4" />
                      Import Repository
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-2 h-2 rounded-full bg-sidebar-accent" />
                    <Skeleton className="h-4 flex-1 bg-sidebar-accent" />
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No projects yet</p>
              <p className="text-xs">Create your first project to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((project) => (
                <ProjectItem
                  key={project.id}
                  project={project}
                  isSelected={selectedProject?.id === project.id}
                  onSelect={onSelectProject}
                  isFavorite={favorites.includes(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account Selector at Bottom */}
      <div className="p-4 border-t border-sidebar-border bg-gradient-to-r from-primary/5 to-accent/5 mt-auto">
        <LoginArea className="w-full" />
      </div>
    </div>
  );
}