import { encodeBase64 } from '@std/encoding/base64';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { addConsoleMessage, getConsoleMessages, type ConsoleMessage } from '@/lib/consoleMessages';
import { useConsoleError } from '@/hooks/useConsoleError';
import { useBuildProject } from '@/hooks/useBuildProject';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FolderOpen, ArrowLeft, Bug, Copy, Check, Loader2, Code, X, Terminal, Expand, Shrink, Hammer, RefreshCw, Save } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { GitStatusIndicator } from '@/components/GitStatusIndicator';
import { BranchSwitcher } from '@/components/BranchSwitcher';
import { BrowserAddressBar } from '@/components/ui/browser-address-bar';
import { type DeviceMode } from '@/components/ui/device-toggle';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { FileTree } from './FileTree';
import { FileEditor } from './FileEditor';
import { Terminal as TerminalComponent } from '@/components/Terminal';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/hooks/useAppContext';
import { isMediaFile } from '@/lib/fileUtils';

interface PreviewPaneProps {
  projectId: string;
  activeTab: 'preview' | 'code';
  onToggleView?: () => void;
  isPreviewable?: boolean;
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params: {
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body: string | null;
    }
  };
  id: number;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string | null;
  }
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
  id: number;
}

export function PreviewPane({ projectId, activeTab, onToggleView, isPreviewable = true }: PreviewPaneProps) {
  const { t } = useTranslation();
  const { config } = useAppContext();
  const { previewDomain } = config;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFileTab, setActiveFileTab] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [editedContents, setEditedContents] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();
  const [hasBuiltProject, setHasBuiltProject] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['/']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('laptop');
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logsPanelTab, setLogsPanelTab] = useState<'logs' | 'code' | 'terminal'>('logs');
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframePanelRef = useRef<ImperativePanelHandle>(null);
  const logsPanelRef = useRef<ImperativePanelHandle>(null);
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const projectsManager = useProjectsManager();

  // Use console error state from provider
  const { hasErrors: hasConsoleErrors, clearErrors } = useConsoleError();

  const { mutate: buildProject, isPending: isBuildLoading } = useBuildProject(projectId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [shouldBuild, setShouldBuild] = useState(false);

  // Handle "build" URL parameter on initial load
  useEffect(() => {
    if (searchParams.has('build')) {
      setShouldBuild(true);

      // Remove the build parameter from URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('build');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Build automatically if "build" parameter was present
  useEffect(() => {
    if (shouldBuild && isPreviewable && !isBuildLoading) {
      setShouldBuild(false);
      buildProject(undefined, {
        onError: (error) => {
          console.error('Build failed:', error);
        }
      });
    }
  }, [isBuildLoading, isPreviewable, buildProject, shouldBuild]);

  const loadFileContent = useCallback(async (filePath: string) => {
    // Skip loading media files - they can't be edited as text
    if (isMediaFile(filePath)) {
      setFileContents(prev => ({ ...prev, [filePath]: '' }));
      return;
    }

    // Don't reload if we already have the content
    if (fileContents[filePath]) {
      return;
    }

    setIsLoading(true);
    try {
      const content = await projectsManager.readFile(projectId, filePath);
      setFileContents(prev => ({ ...prev, [filePath]: content }));
    } catch (_error) {
      console.error('Failed to load file:', _error);
      setFileContents(prev => ({ ...prev, [filePath]: '' }));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectsManager, fileContents]);

  const getContentType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'js': 'application/javascript',
      'mjs': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
      'txt': 'text/plain',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  const checkForBuiltProject = useCallback(async () => {
    try {
      const exists = await projectsManager.fileExists(projectId, 'dist/index.html');
      setHasBuiltProject(exists);
    } catch (error) {
      console.error('Failed to check for built project:', error);
      setHasBuiltProject(false);
    }
  }, [projectId, projectsManager]);



  const sendResponse = useCallback((message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {

      const targetOrigin = `https://${projectId}.${previewDomain}`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId, previewDomain]);

  const sendError = useCallback((message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {
      const targetOrigin = `https://${projectId}.${previewDomain}`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId, previewDomain]);

  const handleConsoleMessage = useCallback((message: {
    jsonrpc: '2.0';
    method: 'console';
    params: {
      level: 'log' | 'warn' | 'error' | 'info' | 'debug';
      message: string;
    };
  }) => {
    const { params } = message;

    // Normalize level to ensure it's one of our supported types
    let normalizedLevel: ConsoleMessage['level'] = 'log';
    if (['log', 'warn', 'error', 'info', 'debug'].includes(params.level)) {
      normalizedLevel = params.level as ConsoleMessage['level'];
    }

    // Add to console messages
    addConsoleMessage(normalizedLevel, params.message);

    // Log to parent console for debugging with appropriate level
    console[normalizedLevel](`[IFRAME ${params.level.toUpperCase()}] ${params.message}`);
  }, []);

  const handleUpdateNavigationState = useCallback((message: {
    jsonrpc: '2.0';
    method: 'updateNavigationState';
    params: {
      currentUrl: string;
      canGoBack: boolean;
      canGoForward: boolean;
    };
  }) => {
    const { params } = message;

    try {
      // params.currentUrl is now just a semantic path (e.g., "/about", "/contact?param=value#section")
      const path = params.currentUrl;

      setCurrentPath(path);

      // Update navigation history if this is a new navigation
      // But only if it's different from current path (avoid duplicates)
      if (path !== navigationHistory[historyIndex]) {
        const newHistory = navigationHistory.slice(0, historyIndex + 1);
        newHistory.push(path);
        setNavigationHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    } catch (error) {
      console.error('Failed to handle navigation state:', params.currentUrl, error);
    }
  }, [historyIndex, navigationHistory]);

  const sendNavigationCommand = useCallback((method: string, params?: Record<string, unknown>) => {
    if (iframeRef.current?.contentWindow) {
      const message = {
        jsonrpc: '2.0',
        method,
        params: params || {},
        id: Date.now()
      };
      const targetOrigin = `https://${projectId}.${previewDomain}`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId, previewDomain]);

  const navigateIframe = useCallback((url: string) => {
    // Send semantic path directly (e.g., "/about", "/contact")
    // The iframe's NavigationHandler will handle this as semantic navigation
    sendNavigationCommand('navigate', { url });
  }, [sendNavigationCommand]);

  const refreshIframe = useCallback(() => {
    sendNavigationCommand('refresh');
  }, [sendNavigationCommand]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const handleFetch = useCallback(async (request: JSONRPCRequest) => {
    const { params, id } = request;
    const { request: fetchRequest } = params;

    try {
      // Parse the URL and validate origin
      const url = new URL(fetchRequest.url);
      const expectedOrigin = `https://${projectId}.${previewDomain}`;

      if (url.origin !== expectedOrigin) {
        console.log(`Invalid origin: ${url.origin}, expected: ${expectedOrigin}`);
        sendError({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'Invalid URL - origin mismatch',
            data: { url: fetchRequest.url, expectedOrigin }
          },
          id
        });
        return;
      }

      const path = url.pathname;
      const filePath = path;

      // Skip SPA fallback for static assets (files with extensions)
      const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(path);

      // SPA routing: try to serve the exact file first
      try {
        const bytes = await projectsManager.readFileBytes(projectId, 'dist' + filePath);
        console.log(`Serving file: ${filePath}`);

        sendResponse({
          jsonrpc: '2.0',
          result: {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': getContentType(filePath),
              'Cache-Control': 'no-cache',
            },
            body: encodeBase64(bytes),
          },
          id
        });
        return;
      } catch {

        // For static assets, return 404 immediately
        if (isStaticAsset) {

          sendResponse({
            jsonrpc: '2.0',
            result: {
              status: 404,
              statusText: 'Not Found',
              headers: {
                'Content-Type': 'text/plain',
              },
              body: encodeBase64(`Static asset not found: ${path}`),
            },
            id
          });
          return;
        }
      }

      // SPA fallback: serve index.html for non-file requests (SPA routing)
      try {
        const bytes = await projectsManager.readFileBytes(projectId, 'dist/index.html');
        console.log(`Serving index.html fallback for: ${path}`);

        sendResponse({
          jsonrpc: '2.0',
          result: {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache',
            },
            body: encodeBase64(bytes),
          },
          id
        });
      } catch {
        // Even index.html doesn't exist
        sendResponse({
          jsonrpc: '2.0',
          result: {
            status: 404,
            statusText: 'Not Found',
            headers: {
              'Content-Type': 'text/plain',
            },
            body: encodeBase64(`File not found: ${path}`),
          },
          id
        });
      }
    } catch (error) {
      console.error('Error processing fetch request:', error);
      sendError({
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Request processing error',
          data: { url: fetchRequest.url, error: String(error) }
        },
        id
      });
    }
  }, [projectId, projectsManager, sendResponse, sendError, previewDomain]);

  // Setup messaging protocol for iframe communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      const expectedOrigin = `https://${projectId}.${previewDomain}`;
      if (event.origin !== expectedOrigin) {
        console.log(`Ignoring message from unexpected origin: ${event.origin}, expected: ${expectedOrigin}`);
        return;
      }

      const message = event.data;
      console.log('Received message from iframe:', message);
      if (message.jsonrpc === '2.0' && message.method === 'fetch') {
        handleFetch(message);
      } else if (message.jsonrpc === '2.0' && message.method === 'console') {
        handleConsoleMessage(message);
      } else if (message.jsonrpc === '2.0' && message.method === 'updateNavigationState') {
        handleUpdateNavigationState(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleFetch, handleConsoleMessage, handleUpdateNavigationState, projectId, previewDomain]);

  // Load content for all open files
  useEffect(() => {
    openFiles.forEach(filePath => {
      if (!fileContents[filePath] && !isMediaFile(filePath)) {
        loadFileContent(filePath);
      }
    });
  }, [openFiles, fileContents, loadFileContent]);

  // Reset selected file and navigation history when projectId changes
  const prevProjectIdRef = useRef<string>();
  useEffect(() => {
    setSelectedFile(null);
    setOpenFiles([]);
    setActiveFileTab(null);
    setFileContents({});
    setEditedContents({});
    setBuildError(null);

    // Reset navigation history and state
    setCurrentPath('/');
    setNavigationHistory(['/']);
    setHistoryIndex(0);

    // Only clear console messages when projectId actually changes (not on initial mount)
    if (prevProjectIdRef.current && prevProjectIdRef.current !== projectId) {
      clearErrors();
    }
    prevProjectIdRef.current = projectId;
  }, [projectId, clearErrors]);

  useEffect(() => {
    checkForBuiltProject();
  }, [checkForBuiltProject]);

  // Listen for build completion events to refresh the iframe
  useEffect(() => {
    const handleBuildComplete = (event: CustomEvent) => {
      if (event.detail?.projectId === projectId) {
        console.log('Build completed for project, refreshing preview');
        // Check for built project and refresh iframe
        checkForBuiltProject();
        refreshIframe();
      }
    };

    window.addEventListener('buildComplete', handleBuildComplete as EventListener);
    return () => window.removeEventListener('buildComplete', handleBuildComplete as EventListener);
  }, [projectId, checkForBuiltProject, refreshIframe]);

  const handleFileSelect = (filePath: string) => {
    // Skip media files
    if (isMediaFile(filePath)) {
      return;
    }
    
    // Add to open files if not already open
    if (!openFiles.includes(filePath)) {
      setOpenFiles(prev => [...prev, filePath]);
    }
    
    // Set as active tab
    setActiveFileTab(filePath);
    setSelectedFile(filePath);
  };

  const handleCloseTab = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Remove from open files
    setOpenFiles(prev => prev.filter(f => f !== filePath));
    
    // Remove from file contents
    setFileContents(prev => {
      const newContents = { ...prev };
      delete newContents[filePath];
      return newContents;
    });
    
    // If this was the active tab, switch to another tab or clear
    if (activeFileTab === filePath) {
      const remainingFiles = openFiles.filter(f => f !== filePath);
      if (remainingFiles.length > 0) {
        setActiveFileTab(remainingFiles[remainingFiles.length - 1]);
        setSelectedFile(remainingFiles[remainingFiles.length - 1]);
      } else {
        setActiveFileTab(null);
        setSelectedFile(null);
      }
    }
  };

  const handleFileSave = async () => {
    if (!activeFileTab) return;
    
    const contentToSave = editedContents[activeFileTab];
    if (contentToSave === undefined || contentToSave === fileContents[activeFileTab]) {
      return; // No changes to save
    }

    setIsSaving(true);
    try {
      await fs.writeFile(`${projectsPath}/${projectId}/${activeFileTab}`, contentToSave);
      setFileContents(prev => ({ ...prev, [activeFileTab]: contentToSave }));
      setEditedContents(prev => {
        const newContents = { ...prev };
        delete newContents[activeFileTab];
        return newContents;
      });

      // Automatically trigger a rebuild after saving a file
      if (isPreviewable) {
        console.log('File saved, triggering rebuild...');
        buildProject(undefined, {
          onError: (error) => {
            console.error('Build failed:', error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedBuildError, setCopiedBuildError] = useState(false);

  const messages = isLogsOpen ? getConsoleMessages() : [];

  const copyMessageToClipboard = async (msg: ConsoleMessage, index: number) => {
    try {
      await navigator.clipboard.writeText(msg.message);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy message to clipboard:', error);
    }
  };

  const copyAllMessagesToClipboard = async () => {
    try {
      const allMessages = messages.map(msg => msg.message).join('\n');
      await navigator.clipboard.writeText(allMessages);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (error) {
      console.error('Failed to copy all messages to clipboard:', error);
    }
  };

  const messageCount = messages.length;

  // Programmatically resize panels when isLogsOpen changes
  useEffect(() => {
    if (isLogsOpen) {
      // Open logs panel to 40% and resize iframe to 60%
      logsPanelRef.current?.resize(40);
      iframePanelRef.current?.resize(60);
    } else {
      // Close logs panel and expand iframe to 100%
      logsPanelRef.current?.resize(0);
      iframePanelRef.current?.resize(100);
    }
  }, [isLogsOpen]);

  return (
    <div className="h-full">
      <Tabs value={activeTab} className="h-full">
        {isPreviewable && (
          <TabsContent value="preview" className="h-full mt-0">
            <div
              ref={previewContainerRef}
              className={cn(
                "h-full w-full flex flex-col relative",
                isFullscreen && "fixed inset-0 z-[100] bg-background"
              )}
            >
              {/* Top navigation bar */}
              <div className="h-12 flex items-center gap-2 p-2 border-b bg-background w-full">
                {/* Left side - fullscreen toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="h-8 w-8 p-0"
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                  {isFullscreen ? (
                    <Shrink className="h-4 w-4" />
                  ) : (
                    <Expand className="h-4 w-4" />
                  )}
                </Button>

                {/* Center - address bar with device toggle */}
                <div className="flex-1 px-6">
                  <div className="relative max-w-64 mx-auto">
                    <BrowserAddressBar
                      currentPath={currentPath}
                      onNavigate={hasBuiltProject ? navigateIframe : undefined}
                      onRefresh={hasBuiltProject ? refreshIframe : undefined}
                      navigationHistory={navigationHistory}
                      deviceMode={deviceMode}
                      onDeviceModeChange={setDeviceMode}
                    />
                  </div>
                </div>

                {/* Right side - actions */}
                <div className="flex items-center gap-1">
                  {/* Build button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => buildProject(undefined, {
                      onError: (error) => {
                        console.error('Build failed:', error);
                      }
                    })}
                    disabled={isBuildLoading}
                    className="h-8 gap-2"
                    title={t('buildButtonTooltip')}
                  >
                    {isBuildLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Hammer className="h-4 w-4" />
                    )}
                    <span className="hidden lg:inline">Build</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLogsOpen(!isLogsOpen)}
                    className={cn("h-8 gap-2 relative", isLogsOpen && "bg-muted")}
                    title={t('logsButtonTooltip')}
                  >
                    <Bug className="h-4 w-4" />
                    <span className="hidden lg:inline">Debug</span>
                    {hasConsoleErrors && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-red-500" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 bg-muted/30 min-h-0 overflow-hidden">
                <ResizablePanelGroup direction="vertical" className="h-full">
                  <ResizablePanel 
                    ref={iframePanelRef}
                    defaultSize={isLogsOpen ? 60 : 100} 
                    minSize={30} 
                    className="min-h-0"
                  >
                    <div className="h-full flex items-center justify-center min-h-0">
                      {hasBuiltProject ? (
                        <div
                          className={cn(
                            "h-full transition-all duration-300 ease-in-out bg-background",
                            deviceMode === 'laptop' && "w-full",
                            deviceMode === 'tablet' && "w-full max-w-3xl shadow-lg",
                            deviceMode === 'phone' && "w-full max-w-sm shadow-lg"
                          )}
                        >
                          <iframe
                            key={projectId}
                            ref={iframeRef}
                            src={`https://${projectId}.${previewDomain}/`}
                            className="w-full h-full border-0"
                            title="Project Preview"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                          />
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-muted p-4">
                          <div className="text-center space-y-4 max-w-2xl w-full">
                            <div>
                              <h3 className="text-lg font-semibold mb-2">{t('projectPreview')}</h3>
                              <p className="text-muted-foreground">
                                {t('buildProjectToSeePreview')}
                              </p>
                            </div>
                            {buildError && (
                              <div className="bg-destructive/10 border border-destructive/20 rounded-lg overflow-hidden text-left">
                                <div className="px-4 py-2 bg-destructive/20 border-b border-destructive/20 flex items-center justify-between">
                                  <p className="font-semibold text-destructive text-sm">Build Failed</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(buildError);
                                        setCopiedBuildError(true);
                                        setTimeout(() => setCopiedBuildError(false), 2000);
                                      } catch (error) {
                                        console.error('Failed to copy error to clipboard:', error);
                                      }
                                    }}
                                    className="h-7 px-2 text-xs hover:bg-destructive/10"
                                  >
                                    {copiedBuildError ? (
                                      <>
                                        <Check className="h-3 w-3 mr-1.5" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3 mr-1.5" />
                                        Copy
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-48">
                                  <div className="overflow-x-auto">
                                    <pre className="p-4 text-xs font-mono text-destructive whitespace-pre leading-relaxed">{buildError}</pre>
                                  </div>
                                  <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => {
                                setBuildError(null);
                                buildProject(undefined, {
                                  onSuccess: () => {
                                    setBuildError(null);
                                  },
                                  onError: (error) => {
                                    console.error('Build failed:', error);
                                    setBuildError(error instanceof Error ? error.message : String(error));
                                  }
                                });
                              }}
                              disabled={isBuildLoading}
                              className="gap-2"
                            >
                              {isBuildLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Building...
                                </>
                              ) : buildError ? (
                                <>
                                  <RefreshCw className="h-4 w-4" />
                                  Retry
                                </>
                              ) : (
                                <>
                                  <Hammer className="h-4 w-4" />
                                  Build
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className={cn(!isLogsOpen && "hidden")} />
                  <ResizablePanel 
                    ref={logsPanelRef}
                    defaultSize={isLogsOpen ? 40 : 0} 
                    minSize={0} 
                    maxSize={isLogsOpen ? undefined : 0}
                    className="min-h-0 min-w-0"
                    collapsible
                    collapsedSize={0}
                  >
                    {/* Logs Panel */}
                    <Tabs value={logsPanelTab} onValueChange={(v) => setLogsPanelTab(v as 'logs' | 'code' | 'terminal')} className="h-full flex flex-col bg-background border-t overflow-hidden min-h-0 w-full min-w-0">
                      {/* Logs Header */}
                      <div className="h-12 px-4 border-b flex items-center justify-between flex-shrink-0">
                        <TabsList className="h-8">
                          <TabsTrigger value="logs" className="h-7 text-xs gap-1.5">
                            <Bug className="h-3 w-3" />
                            <span>Logs</span>
                            {hasConsoleErrors && (
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="code" className="h-7 text-xs gap-1.5">
                            <Code className="h-3 w-3" />
                            <span>Code</span>
                          </TabsTrigger>
                          <TabsTrigger value="terminal" className="h-7 text-xs gap-1.5">
                            <Terminal className="h-3 w-3" />
                            <span>Terminal</span>
                          </TabsTrigger>
                        </TabsList>
                        <div className="flex items-center gap-2">
                          {logsPanelTab === 'logs' && messageCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={copyAllMessagesToClipboard}
                              className="h-7 px-2 text-xs"
                            >
                              {copiedAll ? (
                                <>
                                  <Check className="h-3 w-3 mr-1.5 text-success" />
                                  {t('copied')}
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1.5" />
                                  {t('copyAll')}
                                </>
                              )}
                            </Button>
                          )}
                          {logsPanelTab === 'code' && (
                            <>
                              <BranchSwitcher projectId={projectId} />
                              {activeFileTab && (() => {
                                const hasUnsavedChanges = editedContents[activeFileTab] !== undefined && 
                                  editedContents[activeFileTab] !== fileContents[activeFileTab];
                                return (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleFileSave}
                                    disabled={!hasUnsavedChanges || isSaving || isLoading}
                                    className="h-7 gap-1.5 text-xs"
                                  >
                                    {isSaving ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        <span className="hidden sm:inline">{t('saving')}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Save className="h-3 w-3" />
                                        <span className="hidden sm:inline">{t('save')}</span>
                                      </>
                                    )}
                                  </Button>
                                );
                              })()}
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsLogsOpen(false)}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {/* Panel Content */}
                      <div className="flex-1 min-h-0 overflow-hidden w-full">
                        {/* Logs Tab */}
                        <TabsContent value="logs" className="h-full mt-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
                          <ScrollArea className="flex-1 min-h-0">
                            <div className="p-2 space-y-0 w-full min-w-0 max-w-full">
                              {messageCount === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                  <p className="text-sm text-muted-foreground font-medium">No console messages</p>
                                  <p className="text-xs text-muted-foreground mt-1">Messages from your project will appear here</p>
                                </div>
                              ) : (
                                messages.map((msg, index) => (
                                  <div
                                    key={index}
                                    className="group relative py-0.5 px-1 hover:bg-muted/50 transition-colors duration-150 rounded cursor-pointer w-full max-w-full"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyMessageToClipboard(msg, index);
                                    }}
                                  >
                                    <div 
                                      className={cn(
                                        "text-xs font-mono leading-tight whitespace-pre-wrap break-words w-full min-w-0 max-w-full",
                                        msg.level === 'error' ? "text-destructive" :
                                          msg.level === 'warn' ? "text-warning" :
                                            msg.level === 'info' ? "text-primary" :
                                              "text-muted-foreground"
                                      )}
                                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                    >
                                      {msg.message}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        copyMessageToClipboard(msg, index);
                                      }}
                                      className="h-3 w-3 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 absolute right-1 top-1 hover:bg-muted/70 text-muted-foreground hover:text-foreground bg-background/80 rounded border"
                                    >
                                      {copiedMessageIndex === index ? (
                                        <Check className="h-2 w-2 text-success" />
                                      ) : (
                                        <Copy className="h-2 w-2" />
                                      )}
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </TabsContent>
                        {/* Code Tab */}
                        <TabsContent value="code" className="h-full mt-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
                          <div className="flex-1 min-h-0 flex">
                            <div className="w-1/3 border-r flex flex-col min-h-0">
                              <ScrollArea className="flex-1 min-h-0">
                                <ScrollBar orientation="horizontal" />
                                <div className="min-w-max">
                                  <FileTree
                                    projectId={projectId}
                                    onFileSelect={handleFileSelect}
                                    selectedFile={activeFileTab}
                                  />
                                </div>
                              </ScrollArea>
                            </div>
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                              {openFiles.length > 0 ? (
                                <>
                                  {/* File Tabs */}
                                  <div className="border-b flex-shrink-0 w-full overflow-x-auto overflow-y-hidden">
                                    <div className="flex items-center gap-1 px-2" style={{ width: 'max-content' }}>
                                      {openFiles.map((filePath) => {
                                        const fileName = filePath.split('/').pop() || filePath;
                                        const hasUnsavedChanges = editedContents[filePath] !== undefined && 
                                          editedContents[filePath] !== fileContents[filePath];
                                        const isActive = activeFileTab === filePath;
                                        
                                        return (
                                          <button
                                            key={filePath}
                                            onClick={() => {
                                              setActiveFileTab(filePath);
                                              setSelectedFile(filePath);
                                            }}
                                            className={cn(
                                              "flex items-center gap-2 px-3 py-1.5 text-sm border-b-2 transition-colors flex-shrink-0 whitespace-nowrap",
                                              isActive 
                                                ? "border-primary text-foreground" 
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                          >
                                            <span>{fileName}</span>
                                            {hasUnsavedChanges && (
                                              <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                            )}
                                            <button
                                              onClick={(e) => handleCloseTab(filePath, e)}
                                              className="ml-1 hover:bg-muted rounded p-0.5 flex-shrink-0"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {/* Editor */}
                                  {activeFileTab && (
                                    <FileEditor
                                      filePath={activeFileTab}
                                      content={editedContents[activeFileTab] !== undefined 
                                        ? editedContents[activeFileTab] 
                                        : (fileContents[activeFileTab] ?? '')}
                                      onContentChange={(content) => {
                                        setEditedContents(prev => ({ ...prev, [activeFileTab]: content }));
                                      }}
                                      isLoading={isLoading && !fileContents[activeFileTab]}
                                      projectId={projectId}
                                    />
                                  )}
                                </>
                              ) : (
                                <div className="h-full flex items-center justify-center">
                                  <div className="text-center">
                                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-muted-foreground">
                                      {t('selectFileFromExplorer')}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                        {/* Terminal Tab */}
                        <TabsContent value="terminal" className="h-full mt-0 m-0 data-[state=active]:flex data-[state=active]:flex-col">
                          <div className="flex-1 min-h-0">
                            <TerminalComponent cwd={`${projectsPath}/${projectId}`} />
                          </div>
                        </TabsContent>
                      </div>
                    </Tabs>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>

              {/* Build loading overlay */}
              {isBuildLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="bg-background/90 border rounded-lg p-4 shadow-lg flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Building project...</span>
                      <span className="text-xs text-muted-foreground">Preview will update automatically</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}