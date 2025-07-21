import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ChatPane } from '@/components/Shakespeare/ChatPane';
import { PreviewPane } from '@/components/Shakespeare/PreviewPane';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Eye, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AISettingsDialog } from '@/components/ai/AISettingsDialog';
import { useIsMobile } from '@/hooks/useIsMobile';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'chat' | 'preview' | 'code'>('preview');
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold truncate">{project.name}</h1>
            </div>
          </div>

          <AISettingsDialog />
        </header>

        <div className="flex-1 overflow-hidden">
          {mobileView === 'chat' && (
            <ChatPane projectId={project.id} projectName={project.name} />
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
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-primary/10 supports-[backdrop-filter]:via-accent/5 supports-[backdrop-filter]:to-primary/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.id}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <AISettingsDialog />
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
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/3 border-r">
          <ChatPane projectId={project.id} projectName={project.name} />
        </div>
        <div className="flex-1">
          <PreviewPane
            projectId={project.id}
            activeTab={activeTab}
          />
        </div>
      </div>
    </div>
  );
}
