import { encodeBase64 } from '@std/encoding/base64';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useBuildProject } from '@/hooks/useBuildProject';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FolderOpen, ArrowLeft, X, Bug, Copy, Check, Play, Loader2, MenuIcon, Code } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { GitStatusIndicator } from '@/components/GitStatusIndicator';
import { BrowserAddressBar } from '@/components/ui/browser-address-bar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { FileTree } from './FileTree';
import { FileEditor } from './FileEditor';

// Get iframe domain from environment variable
const IFRAME_DOMAIN = import.meta.env.VITE_IFRAME_DOMAIN || 'local-shakespeare.dev';

interface PreviewPaneProps {
  projectId: string;
  activeTab: 'preview' | 'code';
  onToggleView?: () => void;
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

interface ConsoleMessage {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
}

export function PreviewPane({ projectId, activeTab, onToggleView }: PreviewPaneProps) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileCodeView, setMobileCodeView] = useState<'explorer' | 'editor'>('explorer');
  const isMobile = useIsMobile();
  const [hasBuiltProject, setHasBuiltProject] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['/']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { fs } = useFS();
  const projectsManager = useProjectsManager();
  const { mutate: buildProject, isPending: isBuildLoading } = useBuildProject(projectId);

  const handleBuildProject = () => {
    buildProject(undefined, {
      onError: (error) => {
        console.error('Build failed:', error);
      }
    });
  };

  const loadFileContent = useCallback(async (filePath: string) => {
    setIsLoading(true);
    try {
      const content = await projectsManager.readFile(projectId, filePath);
      setFileContent(content);
    } catch (_error) {
      console.error('Failed to load file:', _error);
      setFileContent('');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, projectsManager]);

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

  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      // Force reload the iframe by updating its src
      iframeRef.current.src = '/';
      // Use a small timeout to ensure the src is cleared before setting it back
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = `https://${projectId}.${IFRAME_DOMAIN}${currentPath}`;
        }
      }, 10);
    }
  }, [currentPath, projectId]);

  const navigateToPath = useCallback((path: string) => {
    if (iframeRef.current) {
      const baseUrl = `https://${projectId}.${IFRAME_DOMAIN}`;
      const newUrl = `${baseUrl}${path}`;
      iframeRef.current.src = newUrl;
      setCurrentPath(path);

      // Update navigation history
      const newHistory = navigationHistory.slice(0, historyIndex + 1);
      newHistory.push(path);
      setNavigationHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [projectId, navigationHistory, historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const path = navigationHistory[newIndex];
      setHistoryIndex(newIndex);
      setCurrentPath(path);

      if (iframeRef.current) {
        const baseUrl = `https://${projectId}.${IFRAME_DOMAIN}`;
        const newUrl = `${baseUrl}${path}`;
        iframeRef.current.src = newUrl;
      }
    }
  }, [historyIndex, navigationHistory, projectId]);

  const goForward = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const path = navigationHistory[newIndex];
      setHistoryIndex(newIndex);
      setCurrentPath(path);

      if (iframeRef.current) {
        const baseUrl = `https://${projectId}.${IFRAME_DOMAIN}`;
        const newUrl = `${baseUrl}${path}`;
        iframeRef.current.src = newUrl;
      }
    }
  }, [historyIndex, navigationHistory, projectId]);

  const sendResponse = useCallback((message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {
      console.log(`Sending response to iframe:`, message);
      const targetOrigin = `https://${projectId}.${IFRAME_DOMAIN}`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId]);

  const sendError = useCallback((message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {
      const targetOrigin = `https://${projectId}.${IFRAME_DOMAIN}`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId]);

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

    const newConsoleMessage: ConsoleMessage = {
      id: Date.now(),
      level: normalizedLevel,
      message: params.message,
    };

    setConsoleMessages(prev => [...prev, newConsoleMessage]);

    // Log to parent console for debugging with appropriate level
    console[normalizedLevel](`[IFRAME ${params.level.toUpperCase()}] ${params.message}`);
  }, []);

  const handleFetch = useCallback(async (request: JSONRPCRequest) => {
    const { params, id } = request;
    const { request: fetchRequest } = params;

    console.log(`Preview iframe requesting: ${fetchRequest.url}`);

    try {
      // Parse the URL and validate origin
      const url = new URL(fetchRequest.url);
      const expectedOrigin = `https://${projectId}.${IFRAME_DOMAIN}`;

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
        // File not found, try SPA fallback to index.html
        console.log(`File not found: ${filePath}, trying index.html fallback`);
      }

      // SPA fallback: serve index.html for non-file requests
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
        console.log(`No files found, returning 404 for: ${path}`);

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
  }, [projectId, projectsManager, sendResponse, sendError]);

  // Setup messaging protocol for iframe communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      const expectedOrigin = `https://${projectId}.${IFRAME_DOMAIN}`;
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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleFetch, handleConsoleMessage, projectId]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, loadFileContent]);

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
    setSelectedFile(filePath);
    if (isMobile) {
      setMobileCodeView('editor');
    }
  };

  const handleFileSave = async (content: string) => {
    if (!selectedFile) return;

    try {
      await fs.writeFile(`/projects/${projectId}/${selectedFile}`, content);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const ConsoleDropdown = () => {
    const getLevelColor = (level: ConsoleMessage['level']) => {
      switch (level) {
        case 'error': return 'text-red-500';
        case 'warn': return 'text-yellow-500';
        case 'info': return 'text-blue-500';
        case 'debug': return 'text-gray-500';
        default: return 'text-gray-400';
      }
    };

    const getLevelIcon = (level: ConsoleMessage['level']) => {
      switch (level) {
        case 'error': return '!';
        case 'warn': return '⚠';
        case 'info': return 'ℹ';
        case 'debug': return '🔍';
        default: return '•';
      }
    };

    const clearConsole = () => {
      setConsoleMessages([]);
    };

    const copyMessageToClipboard = async (msg: ConsoleMessage) => {
      try {
        // Create a formatted string with all message details
        const formattedMessage = `[${msg.level.toUpperCase()}] ${msg.message}`;

        await navigator.clipboard.writeText(formattedMessage);
        setCopiedMessageId(msg.id);

        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
      } catch (error) {
        console.error('Failed to copy message to clipboard:', error);
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative">
            <Bug className="h-4 w-4" />
            {consoleMessages.some(msg => msg.level === 'error') && (
              <span className="absolute bottom-0 left-0 h-2 w-2 bg-red-500 rounded-full"></span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96 max-w-96 max-h-96 overflow-x-hidden">
          <div className="flex items-center justify-between p-2 border-b">
            <span className="font-medium text-sm">Console Output ({consoleMessages.length})</span>
            <Button variant="ghost" size="sm" onClick={clearConsole}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="h-80 w-full max-w-full overflow-x-hidden">
            <div className="space-y-1 p-2 w-full max-w-full overflow-x-hidden">
              {consoleMessages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No console messages
                </div>
              ) : (
                consoleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-xs font-mono p-2 rounded ${getLevelColor(msg.level)} bg-muted/50 group relative w-full overflow-hidden`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="whitespace-pre-wrap break-all flex-1 pr-2 overflow-x-hidden">{getLevelIcon(msg.level)} {msg.message}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyMessageToClipboard(msg)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const Menu = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <MenuIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {(!isMobile && onToggleView) && (
            <DropdownMenuItem
              onClick={onToggleView}
              className="gap-2"
            >
              <Code className="h-4 w-4" />
              View Code
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={handleBuildProject}
            disabled={isBuildLoading}
            className="gap-2"
          >
            {isBuildLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isBuildLoading ? 'Building...' : 'Build'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="h-full">
      <Tabs value={activeTab} className="h-full">
        <TabsContent value="preview" className="h-full mt-0">
          <div className="h-full w-full flex flex-col relative">
            {/* Always show browser address bar */}
            <div className="h-12 flex items-center w-full">
              <BrowserAddressBar
                currentPath={currentPath}
                onNavigate={hasBuiltProject ? navigateToPath : undefined}
                onRefresh={hasBuiltProject ? refreshIframe : undefined}
                onBack={hasBuiltProject ? goBack : undefined}
                onForward={hasBuiltProject ? goForward : undefined}
                canGoBack={hasBuiltProject && historyIndex > 0}
                canGoForward={hasBuiltProject && historyIndex < navigationHistory.length - 1}
                extraContent={(
                  <div className="flex items-center">
                    <ConsoleDropdown />
                    <Menu />
                  </div>
                )}
              />
            </div>

            {/* Content area */}
            <div className="flex-1">
              {hasBuiltProject ? (
                <iframe
                  ref={iframeRef}
                  src={`https://${projectId}.${IFRAME_DOMAIN}${currentPath}`}
                  className="w-full h-full border-0"
                  title="Project Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-muted">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">{t('projectPreview')}</h3>
                    <p className="text-muted-foreground mb-4">
                      {t('buildProjectToSeePreview')}
                    </p>
                    <Button
                      onClick={handleBuildProject}
                      disabled={isBuildLoading}
                      variant="outline"
                      className="gap-2"
                    >
                      {isBuildLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Building...
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5" />
                          Build Project
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Build loading overlay */}
            {isBuildLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="bg-background/90 border rounded-lg p-4 shadow-lg flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Building project...</span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="code" className="h-full mt-0">
          {isMobile ? (
            <div className="h-full flex flex-col">
              {mobileCodeView === 'explorer' ? (
                <ScrollArea className="flex-1">
                  <ScrollBar orientation="horizontal" />
                  <div className="min-w-max">
                    <FileTree
                      projectId={projectId}
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                    />
                  </div>
                </ScrollArea>
              ) : (
                <>
                  <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-accent/5 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileCodeView('explorer')}
                      className="p-1"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold flex-1 truncate bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {selectedFile ? selectedFile.split('/').pop() : t('fileEditor')}
                    </h3>
                    <GitStatusIndicator projectId={projectId} />
                  </div>
                  <div className="flex-1">
                    {selectedFile ? (
                      <FileEditor
                        filePath={selectedFile}
                        content={fileContent}
                        onSave={handleFileSave}
                        isLoading={isLoading}
                        projectId={projectId}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            {t('selectFileFromExplorer')}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMobileCodeView('explorer')}
                            className="mt-4"
                          >
                            {t('openFileExplorer')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Code view header with back button */}
              {!isMobile && onToggleView && (
                <div className="h-12 px-4 border-b flex items-center bg-gradient-to-r from-muted/20 to-background">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleView}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToPreview')}
                  </Button>
                  <div className="flex-1" />
                  <GitStatusIndicator projectId={projectId} />
                </div>
              )}

              <div className="flex-1 flex min-h-0">
                <div className="w-1/3 border-r flex flex-col">
                  <ScrollArea className="flex-1">
                    <ScrollBar orientation="horizontal" />
                    <div className="min-w-max">
                      <FileTree
                        projectId={projectId}
                        onFileSelect={handleFileSelect}
                        selectedFile={selectedFile}
                      />
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex-1">
                  {selectedFile ? (
                    <FileEditor
                      filePath={selectedFile}
                      content={fileContent}
                      onSave={handleFileSave}
                      isLoading={isLoading}
                      projectId={projectId}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-muted-foreground">
                          {t('selectFileFromExplorer')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}