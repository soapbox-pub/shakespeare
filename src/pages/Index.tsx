import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Folder, Menu, Columns2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSeoMeta } from '@unhead/react';
import { cn } from '@/lib/utils';

export default function Index() {
  const [prompt, setPrompt] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const isMobile = useIsMobile();

  useSeoMeta({
    title: 'Shakespeare - AI-Powered Nostr Development',
    description: 'Build custom Nostr websites with AI assistance using Shakespeare, an AI-powered development environment.',
  });

  const loadProjects = useCallback(async () => {
    try {
      await projectsManager.init();
      const projectList = await projectsManager.getProjects();
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectsManager]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!prompt.trim()) return;

    setIsCreating(true);
    try {
      const project = await projectsManager.createProject(prompt.trim());
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleProjectSelect = (project: Project | null) => {
    if (project) {
      navigate(`/project/${project.id}`);
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-primary/5 to-accent/5">
        {/* Mobile Header */}
        <header className="border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Shakespeare
          </h1>
          <div className="w-8" /> {/* Spacer */}
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarVisible && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="fixed left-0 top-0 h-full w-80 max-w-[80vw] bg-background border-r shadow-lg">
              <ProjectSidebar
                selectedProject={null}
                onSelectProject={handleProjectSelect}
              />
            </div>
            <div
              className="absolute inset-0"
              onClick={() => setIsSidebarVisible(false)}
            />
          </div>
        )}

        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 md:mb-12">
              <div className="text-4xl md:text-6xl mb-4 md:mb-6">🎭</div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Shakespeare
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-2">
                Build custom Nostr websites with AI assistance
              </p>
              <p className="text-sm text-muted-foreground">
                <a href="https://soapbox.pub/mkstack" className="hover:underline focus-ring text-primary">
                  Vibed with MKStack
                </a>
              </p>
            </div>

            <div className="mb-8 md:mb-12">
              <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Create a New Project</CardTitle>
                      <CardDescription className="text-base">
                        Describe what kind of Nostr website you want to build
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[120px] touch-action-manipulation overscroll-contain text-base leading-relaxed"
                    disabled={isCreating}
                  />
                  <Button
                    onClick={handleCreateProject}
                    disabled={!prompt.trim() || isCreating}
                    className="w-full focus-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
                    size="lg"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating Project...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Project
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Your Projects</h2>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 md:p-6">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <Card className="bg-gradient-to-br from-muted/50 to-muted/20 border-dashed border-2 border-muted-foreground/20">
                  <CardContent className="text-center py-8 md:py-12">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Folder className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm md:text-base">No projects yet. Create your first project above!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <Card
                      key={project.id}
                      className="cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 focus-ring bg-gradient-to-br from-card to-card/80 border-primary/10 hover:border-primary/20 hover:scale-[1.02]"
                      onClick={() => handleProjectClick(project.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleProjectClick(project.id);
                        }
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base md:text-lg">{project.name}</CardTitle>
                        <CardDescription className="text-sm">
                          Created {project.createdAt.toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs md:text-sm text-muted-foreground">
                          Last modified {project.lastModified.toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      <div className={cn("w-80 border-r bg-sidebar transition-all duration-300", isSidebarVisible ? "block" : "hidden")}>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={handleProjectSelect}
          className="h-full"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="min-h-full bg-gradient-to-br from-primary/5 to-accent/5">
            {/* Header */}
            {!isSidebarVisible && (
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
                  Shakespeare
                </h1>
              </header>
            )}

            <div className="container mx-auto px-4 py-6 md:py-8">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8 md:mb-12">
                  <div className="text-4xl md:text-6xl mb-4 md:mb-6">🎭</div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Shakespeare
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground mb-2">
                    Build custom Nostr websites with AI assistance
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <a href="https://soapbox.pub/mkstack" className="hover:underline focus-ring text-primary">
                      Vibed with MKStack
                    </a>
                  </p>
                </div>

                <div className="mb-8 md:mb-12">
                  <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Plus className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">Create a New Project</CardTitle>
                          <CardDescription className="text-base">
                            Describe what kind of Nostr website you want to build
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[120px] touch-action-manipulation overscroll-contain text-base leading-relaxed"
                        disabled={isCreating}
                      />
                      <Button
                        onClick={handleCreateProject}
                        disabled={!prompt.trim() || isCreating}
                        className="w-full focus-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
                        size="lg"
                      >
                        {isCreating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating Project...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Project
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6">Your Projects</h2>

                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <Card key={i}>
                          <CardContent className="p-4 md:p-6">
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-3 w-1/2" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : projects.length === 0 ? (
                    <Card className="bg-gradient-to-br from-muted/50 to-muted/20 border-dashed border-2 border-muted-foreground/20">
                      <CardContent className="text-center py-8 md:py-12">
                        <div className="flex items-center justify-center gap-2 mb-4">
                          <Folder className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-sm md:text-base">No projects yet. Create your first project above!</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map((project) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 focus-ring bg-gradient-to-br from-card to-card/80 border-primary/10 hover:border-primary/20 hover:scale-[1.02]"
                          onClick={() => handleProjectClick(project.id)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleProjectClick(project.id);
                            }
                          }}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base md:text-lg">{project.name}</CardTitle>
                            <CardDescription className="text-sm">
                              Created {project.createdAt.toLocaleDateString()}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-xs md:text-sm text-muted-foreground">
                              Last modified {project.lastModified.toLocaleDateString()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}