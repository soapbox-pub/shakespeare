import React, { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Folder, GitBranch, MoreVertical, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoginArea } from '@/components/auth/LoginArea';
import { StarButton } from '@/components/StarButton';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useProjectSessionStatus } from '@/hooks/useProjectSessionStatus';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Project } from '@/lib/ProjectsManager';
import { cn } from '@/lib/utils';

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  onSelect: (project: Project) => void;
}

const ProjectItem = memo(({ project, isSelected, onSelect }: ProjectItemProps) => {
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
      <div className="w-full p-3 text-left text-sidebar-foreground">
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
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate mb-1">
                {project.name}
              </h3>
            </div>

            {/* Star Button */}
            <div className="flex-shrink-0 relative">
              <StarButton
                projectId={project.id}
                projectName={project.name}
                showToast={false}
                className="h-6 w-6 hover:bg-primary/20"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProjectItem.displayName = 'ProjectItem';

interface ProjectSidebarProps {
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  className?: string;
}

export function ProjectSidebar({
  selectedProject,
  onSelectProject,
  className
}: ProjectSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites] = useLocalStorage<string[]>('project-favorites', []);
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();

  // Load projects on mount
  React.useEffect(() => {
    const loadProjects = async () => {
      try {
        await projectsManager.init();
        const projectList = await projectsManager.getProjects();
        setProjects(projectList);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [projectsManager]);

  const handleNewProject = () => {
    onSelectProject(null);
    navigate('/');
  };

  const isFavorite = (projectId: string) => favorites.includes(projectId);

  // Sort projects: favorites first, then by lastModified (newest first)
  const sortedProjects = projects.sort((a, b) => {
    const aIsFavorite = isFavorite(a.id);
    const bIsFavorite = isFavorite(b.id);

    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;

    return b.lastModified.getTime() - a.lastModified.getTime();
  });

  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-b from-sidebar to-sidebar/95", className)}>
      {/* Header with Logo */}
      <div className="flex px-4 h-12 border-b border-sidebar-border bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
          >
            <span className="text-2xl">🎭</span>
            <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Shakespeare
            </h1>
          </button>
          <div className="flex items-center gap-1">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10">
                <MoreVertical className="h-4 w-4 text-primary/60 hover:text-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => navigate('/clone')}
                className="flex items-center gap-2 w-full"
              >
                <GitBranch className="h-4 w-4" />
                Import Repository
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 w-full"
              >
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <div className="mb-2">
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              onClick={handleNewProject}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
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
              {sortedProjects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onSelect={onSelectProject}
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