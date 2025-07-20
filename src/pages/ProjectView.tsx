import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ProjectsManager, type Project } from '@/lib/fs';
import { useFS } from '@/hooks/useFS';
import { ChatPane } from '@/components/Shakespeare/ChatPane';
import { PreviewPane } from '@/components/Shakespeare/PreviewPane';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AISettingsDialog } from '@/components/ai/AISettingsDialog';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const { fs } = useFS();
  const projectsManager = useMemo(() => new ProjectsManager(fs), [fs]);
  const navigate = useNavigate();

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

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{project.name}</h1>
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
