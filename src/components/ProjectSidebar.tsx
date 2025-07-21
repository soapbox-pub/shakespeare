import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Info, MoreVertical, Trash2, Eye, Star, Bug, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { LoginArea } from '@/components/auth/LoginArea';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/useToast';
import type { Project } from '@/lib/ProjectsManager';
import { cn } from '@/lib/utils';

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [favorites, setFavorites] = useLocalStorage<string[]>('project-favorites', []);
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    navigate('/');
  };

  const handleDeleteProject = async (project: Project) => {
    setIsDeleting(true);
    try {
      await projectsManager.deleteProject(project.id);

      // Remove from local state
      setProjects(prev => prev.filter(p => p.id !== project.id));

      // If the deleted project was selected, deselect it
      if (selectedProject?.id === project.id) {
        onSelectProject(null);
        navigate('/');
      }

      toast({
        title: "Project deleted",
        description: `"${project.name}" has been permanently deleted.`,
      });
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

  const handleToggleFavorite = (project: Project) => {
    const wasFavorite = favorites.includes(project.id);
    const newFavorites = wasFavorite
      ? favorites.filter(id => id !== project.id)
      : [...favorites, project.id];

    setFavorites(newFavorites);

    toast({
      title: wasFavorite ? "Project Unfavorited" : "Project Favorited",
      description: `"${project.name}" has been ${wasFavorite ? 'removed from' : 'added to'} your favorites.`,
    });
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
      <div className="p-4 border-b border-sidebar-border bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity w-full text-left"
        >
          <span className="text-2xl">🎭</span>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Shakespeare
          </h1>
        </button>
      </div>

      {/* Info Section */}
      <div className="p-4 border-b border-sidebar-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-primary/80 uppercase tracking-wide">
              Projects
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-primary/10">
                  <MoreVertical className="h-3 w-3 text-primary/60 hover:text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <a href="https://soapbox.pub/mkstack" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full">
                    <Info className="h-4 w-4" />
                    About MKStack
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://github.com/soapbox-pub/mkstack/issues" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full">
                    <Bug className="h-4 w-4" />
                    Report an Issue
                  </a>
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
            <TooltipProvider>
              <div className="space-y-1">
                {sortedProjects.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      "group relative rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10",
                      selectedProject?.id === project.id && "bg-gradient-to-r from-primary/15 to-accent/15 shadow-sm"
                    )}
                  >
                    <button
                      onClick={() => {
                        onSelectProject(project);
                        navigate(`/project/${project.id}`);
                      }}
                      className="w-full p-3 text-left text-sidebar-foreground"
                    >
                      <div className="flex items-center gap-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative flex items-center">
                              <div className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ready</p>
                          </TooltipContent>
                        </Tooltip>

                        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm truncate">
                                {project.name}
                              </h3>
                              <div className="flex items-center gap-1 ml-auto">
                                {isFavorite(project.id) && (
                                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                )}
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {project.lastModified.toLocaleDateString()}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Dropdown Menu */}
                          <div className="flex-shrink-0 -mt-1 -mr-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-primary/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onClick={() => handleToggleFavorite(project)}
                                >
                                  <Star className={cn(
                                    "h-4 w-4 mr-2",
                                    isFavorite(project.id) ? "text-yellow-500 fill-current" : "text-muted-foreground"
                                  )} />
                                  {isFavorite(project.id) ? "Unfavorite" : "Favorite"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/project/${project.id}`)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Open Project
                                </DropdownMenuItem>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive cursor-pointer"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Project
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Project</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{project.name}"? This action cannot be undone and will permanently delete all project data including files.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteProject(project)}
                                        disabled={isDeleting}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {isDeleting ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Deleting...
                                          </>
                                        ) : (
                                          'Delete Project'
                                        )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </TooltipProvider>
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