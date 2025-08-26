import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { type Project } from '@/lib/ProjectsManager';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { ChatPane } from '@/components/Shakespeare/ChatPane';
import { PreviewPane } from '@/components/Shakespeare/PreviewPane';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Eye, Code, Menu, Columns2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionsMenu } from '@/components/ActionsMenu';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useFS } from '@/hooks/useFS';
import { useJSRuntime } from '@/hooks/useJSRuntime';
import { useKeepAlive } from '@/hooks/useKeepAlive';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { bytesToHex } from 'nostr-tools/utils';
import { buildProject } from "@/lib/build";
import { copyDirectory } from '@/lib/copyFiles';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'chat' | 'preview' | 'code'>('chat');
  const [isBuildLoading, setIsBuildLoading] = useState(false);
  const [isDeployLoading, setIsDeployLoading] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { fs: browserFS } = useFS();
  const { runtime } = useJSRuntime();
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    // Check if we're on mobile immediately to set correct initial state
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // Desktop starts open, mobile starts closed
    }
    return false; // Default to closed for SSR
  });

  // Keep-alive functionality to prevent tab throttling during AI processing
  const { updateMetadata } = useKeepAlive({
    enabled: isAILoading || isBuildLoading || isDeployLoading,
    title: 'Shakespeare',
    artist: project ? `Working on ${project.name}...` : 'Working...',
    artwork: [
      {
        src: '/favicon.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  });

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

  const runBuild = async () => {
    if (isBuildLoading || !project || !browserFS) return;

    setIsBuildLoading(true);
    updateMetadata('Shakespeare', `Building ${project.name}...`);

    try {
      const dist = await buildProject({
        fs: browserFS,
        projectPath: `/projects/${project.id}`,
        domParser: new DOMParser(),
        target: "esnext",
      });

      console.log(dist);

      // Delete all existing files in "dist" directory
      try {
        for (const file of await browserFS.readdir(`/projects/${project.id}/dist`)) {
          await browserFS.unlink(`/projects/${project.id}/dist/${file}`);
        }
      } catch {
        // Ignore errors (e.g., directory doesn't exist)
      }

      await browserFS.mkdir(`/projects/${project.id}/dist`, { recursive: true });

      for (const [path, contents] of Object.entries(dist)) {
        await browserFS.writeFile(`/projects/${project.id}/dist/${path}`, contents);
      }
    } catch (error) {
      console.error('Build failed:', error);
    } finally {
      setIsBuildLoading(false);
    }
  };

  const runDeploy = async () => {
    if (isDeployLoading || !project || !browserFS || !runtime) return;

    setIsDeployLoading(true);
    updateMetadata('Shakespeare', `Deploying ${project.name}...`);

    try {
      const runtimeFS = await runtime.fs();

      const sk = generateSecretKey();
      const pubkey = getPublicKey(sk);
      const npub = nip19.npubEncode(pubkey);

      const projectUrl = `https://${npub}.nostrdeploy.com`;
      console.log('Running deploy for project:', project.id, 'at', projectUrl);

      await runtimeFS.mkdir('dist', { recursive: true });

      await runtimeFS.writeFile('.env.nostr-deploy.local', `# Nostr Deploy CLI Configuration
# This file contains sensitive information - do not commit to version control

# Nostr Authentication
NOSTR_PRIVATE_KEY=${bytesToHex(sk)}
NOSTR_PUBLIC_KEY=${pubkey}
NOSTR_RELAYS=wss://relay.nostr.band,wss://nostrue.com,wss://purplerelay.com,wss://relay.primal.net,wss://ditto.pub/relay

# Blossom File Storage
BLOSSOM_SERVERS=https://cdn.hzrd149.com,https://blossom.primal.net,https://blossom.band,https://blossom.f7z.io

# Deployment Settings
BASE_DOMAIN=nostrdeploy.com`);

      // Copy "dist" files to runtime filesystem
      const distPath = `/projects/${project.id}/dist`;
      try {
        await copyDirectory(browserFS, runtimeFS, distPath, 'dist');
        console.log('Successfully copied dist to runtime');
      } catch (error) {
        console.error('Failed to copy dist to runtime:', error);
        return;
      }

      const proc = await runtime.spawn('npx', ["-y", "nostr-deploy-cli", "deploy"]);
      await proc.exit;

      console.log('Project deployed:', projectUrl);
    } catch (error) {
      console.error('Deploy failed:', error);
    } finally {
      setIsDeployLoading(false);
    }
  };

  const handleNewChat = () => {
    // This will be handled by the ChatPane's internal logic
    console.log('New chat requested');
  };

  const handleAILoadingChange = (loading: boolean) => {
    setIsAILoading(loading);
  };

  // Handle first user interaction to enable audio context
  const handleFirstInteraction = () => {
    // This will be handled automatically by the useKeepAlive hook
    // when isAILoading becomes true after user interaction
  };

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
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold truncate">{project.name}</h1>
            </div>
          </div>

          <ActionsMenu
            projectId={project.id}
            onNewChat={handleNewChat}
            onBuild={runBuild}
            onDeploy={runDeploy}
            isLoading={isAILoading}
            isBuildLoading={isBuildLoading}
            isDeployLoading={isDeployLoading}
            onFirstInteraction={handleFirstInteraction}
          />
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarVisible && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            {/* Backdrop - only covers the area not occupied by the sidebar */}
            <div
              className="absolute inset-0"
              onClick={() => setIsSidebarVisible(false)}
            />
            {/* Sidebar - positioned above the backdrop */}
            <div className="relative left-0 top-0 h-full w-80 max-w-[80vw] bg-background border-r shadow-lg z-10">
              <ProjectSidebar
                selectedProject={project}
                onSelectProject={(selectedProject) => {
                  setProject(selectedProject);
                  setIsSidebarVisible(false); // Always collapse sidebar on mobile navigation
                  if (selectedProject) {
                    setMobileView('chat'); // Switch to chat view when selecting a project
                    navigate(`/project/${selectedProject.id}`);
                  } else {
                    navigate('/');
                  }
                }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {mobileView === 'chat' && (
            <ChatPane
              projectId={project.id}
              projectName={project.name}
              onNewChat={handleNewChat}
              onBuild={runBuild}
              onDeploy={runDeploy}
              onFirstInteraction={handleFirstInteraction}
              onLoadingChange={handleAILoadingChange}
              isLoading={isAILoading}
              isBuildLoading={isBuildLoading}
              isDeployLoading={isDeployLoading}
            />
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
    <div className="h-screen flex bg-background">
      {/* Fixed Sidebar */}
      <div className={`w-80 border-r bg-sidebar transition-all duration-300 ${isSidebarVisible ? 'block' : 'hidden'}`}>
        <ProjectSidebar
          selectedProject={project}
          onSelectProject={(selectedProject) => {
            setProject(selectedProject);
            if (selectedProject) {
              navigate(`/project/${selectedProject.id}`);
            } else {
              navigate('/');
            }
          }}
          className="h-full"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="px-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between h-12">
                    {/* Left side - Sidebar toggle */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                        className="h-8 w-8 p-0"
                        aria-label="Toggle sidebar"
                      >
                        <Columns2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Center - Project title */}
                    <div className="flex-1 min-w-0 ml-2 px-4">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <h2 className="font-semibold text-lg truncate">
                          {project.name}
                        </h2>
                      </div>
                    </div>

                    {/* Right side - Actions Menu */}
                    <div className="flex items-center gap-2">
                      <ActionsMenu
                        projectId={project.id}
                        onNewChat={handleNewChat}
                        onBuild={runBuild}
                        onDeploy={runDeploy}
                        isLoading={isAILoading}
                        isBuildLoading={isBuildLoading}
                        isDeployLoading={isDeployLoading}
                        onFirstInteraction={handleFirstInteraction}
                      />
                    </div>
                  </div>
                </div>

                {/* Chat Content */}
                <div className="flex-1 overflow-hidden">
                  <ChatPane
                    projectId={project.id}
                    projectName={project.name}
                    onNewChat={handleNewChat}
                    onBuild={runBuild}
                    onDeploy={runDeploy}
                    onFirstInteraction={handleFirstInteraction}
                    onLoadingChange={handleAILoadingChange}
                    isLoading={isAILoading}
                    isBuildLoading={isBuildLoading}
                    isDeployLoading={isDeployLoading}
                  />
                </div>
              </div>
            </ResizablePanel>

            {/* Resizable Handle */}
            <ResizableHandle withHandle />

            {/* Preview/Code Panel */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Preview Header */}
                <div className="px-4 border-b flex-shrink-0">
                  <div className="flex items-center justify-between h-12">
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
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-hidden">
                  <PreviewPane
                    projectId={project.id}
                    activeTab={activeTab}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
