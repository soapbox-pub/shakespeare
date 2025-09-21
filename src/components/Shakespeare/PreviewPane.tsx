import { encodeBase64 } from '@std/encoding/base64';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FolderOpen, ArrowLeft, X, Bug, Copy, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { GitStatusIndicator } from '@/components/GitStatusIndicator';
import { BrowserAddressBar } from '@/components/ui/browser-address-bar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { FileTree } from './FileTree';
import { FileEditor } from './FileEditor';

// Get iframe domain from environment variable
const IFRAME_DOMAIN = import.meta.env.VITE_IFRAME_DOMAIN || 'local-shakespeare.dev';

interface PreviewPaneProps {
  projectId: string;
  activeTab: 'preview' | 'code';
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

export function PreviewPane({ projectId, activeTab }: PreviewPaneProps) {
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

  // Legacy refresh function for build completion events
  const refreshIframeLegacy = useCallback(() => {
    if (iframeRef.current) {
      // Force reload the iframe by updating its src
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      // Use a small timeout to ensure the src is cleared before setting it back
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      }, 10);
    }
  }, []);

  const sendResponse = useCallback((message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {

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
      const targetOrigin = `https://${projectId}.${IFRAME_DOMAIN}`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId]);

  const navigateIframe = useCallback((url: string) => {
    // Send semantic path directly (e.g., "/about", "/contact")
    // The iframe's NavigationHandler will handle this as semantic navigation
    sendNavigationCommand('navigate', { url });
  }, [sendNavigationCommand]);

  const refreshIframe = useCallback(() => {
    sendNavigationCommand('refresh');
  }, [sendNavigationCommand]);

  const goBackIframe = useCallback(() => {
    if (historyIndex > 0) {
      // Move back in history
      const newIndex = historyIndex - 1;
      const targetPath = navigationHistory[newIndex];

      setHistoryIndex(newIndex);
      setCurrentPath(targetPath);

      // Tell iframe to navigate to this path
      sendNavigationCommand('navigate', { url: targetPath });
    }
  }, [historyIndex, navigationHistory, sendNavigationCommand]);

  const goForwardIframe = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      // Move forward in history
      const newIndex = historyIndex + 1;
      const targetPath = navigationHistory[newIndex];

      setHistoryIndex(newIndex);
      setCurrentPath(targetPath);

      // Tell iframe to navigate to this path
      sendNavigationCommand('navigate', { url: targetPath });
    }
  }, [historyIndex, navigationHistory, sendNavigationCommand]);

  const handleFetch = useCallback(async (request: JSONRPCRequest) => {
    const { params, id } = request;
    const { request: fetchRequest } = params;



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

        // For non-static assets, try SPA fallback to index.html

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
      } else if (message.jsonrpc === '2.0' && message.method === 'updateNavigationState') {
        handleUpdateNavigationState(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleFetch, handleConsoleMessage, handleUpdateNavigationState, projectId]);

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
        refreshIframeLegacy();
      }
    };

    window.addEventListener('buildComplete', handleBuildComplete as EventListener);
    return () => window.removeEventListener('buildComplete', handleBuildComplete as EventListener);
  }, [projectId, checkForBuiltProject, refreshIframeLegacy]);

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

  return (
    <div className="h-full">
      <Tabs value={activeTab} className="h-full">
        <TabsContent value="preview" className="h-full mt-0">
          {hasBuiltProject ? (
            <div className="h-full w-full flex flex-col">
              <div className="flex items-center border-b w-full">
                <BrowserAddressBar
                  currentPath={currentPath}
                  onNavigate={navigateIframe}
                  onRefresh={refreshIframe}
                  onBack={goBackIframe}
                  onForward={goForwardIframe}
                  canGoBack={historyIndex > 0}
                  canGoForward={historyIndex < navigationHistory.length - 1}
                  extraContent={<ConsoleDropdown />}
                />
              </div>
              <iframe
                ref={iframeRef}
                src={`https://${projectId}.${IFRAME_DOMAIN}/`}
                className="w-full flex-1 border-0"
                title="Project Preview"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-muted">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">{t('projectPreview')}</h3>
                <p className="text-muted-foreground mb-4">
                  {t('buildProjectToSeePreview')}
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="h-full mt-0">
          {isMobile ? (
            <div className="h-full flex flex-col">
              {mobileCodeView === 'explorer' ? (
                <>
                  <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-accent/5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t('fileExplorer')}</h3>
                      <GitStatusIndicator projectId={projectId} />
                    </div>
                  </div>
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
                </>
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
            <div className="h-full flex">
              <div className="w-1/3 border-r">
                <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t('fileExplorer')}</h3>
                    <GitStatusIndicator projectId={projectId} />
                  </div>
                </div>
                <ScrollArea className="h-[calc(100%-60px)]">
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}