import { encodeBase64 } from '@std/encoding/base64';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { addConsoleMessage, getConsoleMessages, type ConsoleMessage } from '@/lib/consoleMessages';
import { useConsoleError } from '@/hooks/useConsoleError';
import { useBuildProject } from '@/hooks/useBuildProject';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FolderOpen, ArrowLeft, Bug, Copy, Check, Play, Loader2, MenuIcon, Code, Rocket, X, Terminal } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { GitStatusIndicator } from '@/components/GitStatusIndicator';
import { BrowserAddressBar } from '@/components/ui/browser-address-bar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FileTree } from './FileTree';
import { FileEditor } from './FileEditor';
import { DeployDialog } from '@/components/DeployDialog';
import { Terminal as TerminalComponent } from '@/components/Terminal';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '@/hooks/useAppContext';
import { isMediaFile } from '@/lib/fileUtils';
import { injectNostrShim, getNostrShimCode, NOSTR_SHIM_PATH } from '@/lib/nostrShim';

interface PreviewPaneProps {
  projectId: string;
  activeTab: 'preview' | 'code';
  onToggleView?: () => void;
  projectName?: string;
  onFirstInteraction?: () => void;
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

export function PreviewPane({ projectId, activeTab, onToggleView, projectName, onFirstInteraction: _onFirstInteraction, isPreviewable = true }: PreviewPaneProps) {
  const { t } = useTranslation();
  const { config } = useAppContext();
  const { previewDomain } = config;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileCodeView, setMobileCodeView] = useState<'explorer' | 'editor' | 'terminal'>('explorer');
  const [desktopCodeView, setDesktopCodeView] = useState<'files' | 'terminal'>('files');
  const isMobile = useIsMobile();
  const [hasBuiltProject, setHasBuiltProject] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['/']);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const projectsManager = useProjectsManager();

  // Use console error state from provider
  const { hasErrors: hasConsoleErrors, clearErrors } = useConsoleError();

  const { mutate: buildProject, isPending: isBuildLoading } = useBuildProject(projectId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [shouldBuild, setShouldBuild] = useState(false);

  const handleBuildProject = useCallback(() => {
    buildProject(undefined, {
      onError: (error) => {
        console.error('Build failed:', error);
      }
    });
  }, [buildProject]);

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
      handleBuildProject();
    }
  }, [isBuildLoading, isPreviewable, handleBuildProject, shouldBuild]);

  const loadFileContent = useCallback(async (filePath: string) => {
    // Skip loading media files - they can't be edited as text
    if (isMediaFile(filePath)) {
      setFileContent('');
      setIsLoading(false);
      return;
    }

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
      iframeRef.current.src = '/';
      // Use a small timeout to ensure the src is cleared before setting it back
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = `https://${projectId}.${previewDomain}/`;
        }
      }, 10);
    }
  }, [projectId, previewDomain]);

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

  // Handle nostr.* requests from iframe (NIP-07 proxy)
  const handleNostrRequest = useCallback(async (message: {
    jsonrpc: '2.0';
    method: string;
    params: Record<string, unknown>;
    id: number;
  }) => {
    const { method, params, id } = message;
    const nostrMethod = method.replace('nostr.', '');
    
    try {
      // Check if window.nostr is available in the parent
      if (!window.nostr) {
        throw new Error('Nostr extension not found. Please install a NIP-07 browser extension.');
      }

      let result: unknown;

      switch (nostrMethod) {
        case 'getPublicKey':
          result = await window.nostr.getPublicKey();
          break;
          
        case 'signEvent':
          result = await window.nostr.signEvent(params.event as Parameters<typeof window.nostr.signEvent>[0]);
          break;
          
        case 'getRelays':
          if (window.nostr.getRelays) {
            result = await window.nostr.getRelays();
          } else {
            result = {};
          }
          break;
          
        case 'nip04.encrypt':
          if (!window.nostr.nip04) {
            throw new Error('NIP-04 encryption not supported by this extension');
          }
          result = await window.nostr.nip04.encrypt(
            params.pubkey as string,
            params.plaintext as string
          );
          break;
          
        case 'nip04.decrypt':
          if (!window.nostr.nip04) {
            throw new Error('NIP-04 decryption not supported by this extension');
          }
          result = await window.nostr.nip04.decrypt(
            params.pubkey as string,
            params.ciphertext as string
          );
          break;
          
        case 'nip44.encrypt':
          if (!window.nostr.nip44) {
            throw new Error('NIP-44 encryption not supported by this extension');
          }
          result = await window.nostr.nip44.encrypt(
            params.pubkey as string,
            params.plaintext as string
          );
          break;
          
        case 'nip44.decrypt':
          if (!window.nostr.nip44) {
            throw new Error('NIP-44 decryption not supported by this extension');
          }
          result = await window.nostr.nip44.decrypt(
            params.pubkey as string,
            params.ciphertext as string
          );
          break;
          
        default:
          throw new Error(`Unknown nostr method: ${nostrMethod}`);
      }

      // Send success response
      sendResponse({
        jsonrpc: '2.0',
        result: result as JSONRPCResponse['result'],
        id
      });
    } catch (error) {
      console.error(`[Preview] Nostr ${nostrMethod} error:`, error);
      sendError({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        id
      });
    }
  }, [sendResponse, sendError]);

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

      // Serve the nostr shim script at the special path
      if (path === NOSTR_SHIM_PATH) {
        console.log('[Preview] Serving nostr shim script');
        const shimCode = getNostrShimCode();
        sendResponse({
          jsonrpc: '2.0',
          result: {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'no-cache',
            },
            body: encodeBase64(new TextEncoder().encode(shimCode)),
          },
          id
        });
        return;
      }

      // SPA routing: try to serve the exact file first
      try {
        const bytes = await projectsManager.readFileBytes(projectId, 'dist' + filePath);
        console.log(`Serving file: ${filePath}`);

        // Inject nostr shim into index.html
        let responseBody: string;
        if (filePath === '/index.html') {
          const html = new TextDecoder().decode(bytes);
          const injectedHtml = injectNostrShim(html);
          responseBody = encodeBase64(new TextEncoder().encode(injectedHtml));
        } else {
          responseBody = encodeBase64(bytes);
        }

        sendResponse({
          jsonrpc: '2.0',
          result: {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': getContentType(filePath),
              'Cache-Control': 'no-cache',
            },
            body: responseBody,
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

        // Inject nostr shim into index.html for SPA fallback
        const html = new TextDecoder().decode(bytes);
        const injectedHtml = injectNostrShim(html);

        sendResponse({
          jsonrpc: '2.0',
          result: {
            status: 200,
            statusText: 'OK',
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'no-cache',
            },
            body: encodeBase64(new TextEncoder().encode(injectedHtml)),
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
      } else if (message.jsonrpc === '2.0' && message.method?.startsWith('nostr.')) {
        handleNostrRequest(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleFetch, handleConsoleMessage, handleUpdateNavigationState, handleNostrRequest, projectId, previewDomain]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, loadFileContent]);

  // Reset selected file and navigation history when projectId changes
  const prevProjectIdRef = useRef<string>();
  useEffect(() => {
    setSelectedFile(null);
    setFileContent('');
    setMobileCodeView('explorer');
    setDesktopCodeView('files');

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
      await fs.writeFile(`${projectsPath}/${projectId}/${selectedFile}`, content);
      setFileContent(content);

      // Automatically trigger a rebuild after saving a file
      if (isPreviewable) {
        console.log('File saved, triggering rebuild...');
        handleBuildProject();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const ConsoleDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);

    const messages = isOpen ? getConsoleMessages() : [];

    const copyMessageToClipboard = async (msg: ConsoleMessage, index: number) => {
      try {
        await navigator.clipboard.writeText(msg.message);
        setCopiedMessageIndex(index);
        setTimeout(() => setCopiedMessageIndex(null), 2000);
      } catch (error) {
        console.error('Failed to copy message to clipboard:', error);
      }
    };

    const messageCount = messages.length;

    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 relative"
          >
            <Bug className="h-4 w-4" />
            {hasConsoleErrors && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-red-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[calc(100vw-1rem)] max-w-[480px] max-h-[512px] overflow-hidden shadow-lg border rounded-lg bg-background p-0"
          sideOffset={4}
        >

          {/* Messages */}
          <div className="h-[60vh] max-h-[512px] w-full bg-background text-foreground font-mono text-xs relative overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="py-2 px-1 space-y-0">
              {messageCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground font-medium">No console messages</p>
                  <p className="text-xs text-muted-foreground mt-1">Messages from your project will appear here</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className="group relative py-0.5 px-1 hover:bg-muted/50 transition-colors duration-150 rounded cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyMessageToClipboard(msg, index);
                    }}
                  >
                    <div className={cn(
                      "text-xs font-mono leading-tight whitespace-pre-wrap break-words",
                      msg.level === 'error' ? "text-destructive" :
                        msg.level === 'warn' ? "text-warning" :
                          msg.level === 'info' ? "text-primary" :
                            "text-muted-foreground"
                    )}>
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
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 h-8 w-8 p-0 bg-muted/50 hover:bg-muted/70 rounded-md z-10 flex items-center justify-center border"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </PopoverContent>
      </Popover>
    );
  };

  const Menu = () => {
    const isAnyLoading = isBuildLoading;

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
        <DropdownMenuContent align="end" className="w-48 sm:w-48">
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
          <DropdownMenuItem
            onClick={() => setDeployDialogOpen(true)}
            disabled={isAnyLoading}
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            Deploy
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="h-full">
      <Tabs value={activeTab} className="h-full">
        {isPreviewable && (
          <TabsContent value="preview" className="h-full mt-0">
            <div className="h-full w-full flex flex-col relative">
              {/* Always show browser address bar */}
              <div className="h-12 flex items-center w-full">
                <BrowserAddressBar
                  currentPath={currentPath}
                  onNavigate={hasBuiltProject ? navigateIframe : undefined}
                  onRefresh={hasBuiltProject ? refreshIframe : undefined}
                  onBack={hasBuiltProject ? goBackIframe : undefined}
                  onForward={hasBuiltProject ? goForwardIframe : undefined}
                  canGoBack={hasBuiltProject && historyIndex > 0}
                  canGoForward={hasBuiltProject && historyIndex < navigationHistory.length - 1}
                  extraContent={(
                    <div className="flex items-center">
                      {(!isMobile && onToggleView && isPreviewable) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onToggleView}
                          className="h-8 gap-2"
                        >
                          <Code className="h-4 w-4" />
                        </Button>
                      )}
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
                    key={projectId}
                    ref={iframeRef}
                    src={`https://${projectId}.${previewDomain}/`}
                    className="w-full h-full border-0"
                    title="Project Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
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

        <TabsContent value="code" className="h-full mt-0">
          {isMobile ? (
            <div className="h-full flex flex-col min-h-0">
              {mobileCodeView === 'explorer' ? (
                <div className="flex-1 relative min-h-0">
                  <ScrollArea className="h-full">
                    <ScrollBar orientation="horizontal" />
                    <div className="min-w-max">
                      <FileTree
                        projectId={projectId}
                        onFileSelect={handleFileSelect}
                        selectedFile={selectedFile}
                      />
                    </div>
                  </ScrollArea>
                  {/* Floating Terminal Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobileCodeView('terminal')}
                    className="fixed right-4 bottom-14 mb-safe z-20 size-12 p-0 rounded-full shadow-lg bg-background border-2"
                  >
                    <Terminal className="h-6 w-6" />
                  </Button>
                </div>
              ) : mobileCodeView === 'terminal' ? (
                <>
                  <div className="h-12 px-3 flex items-center gap-2 bg-black text-purple-400 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileCodeView('explorer')}
                      className="p-1 hover:bg-transparent hover:text-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-semibold">
                      Terminal
                    </h3>
                  </div>
                  <div className="flex-1 min-h-0">
                    <TerminalComponent cwd={`${projectsPath}/${projectId}`} />
                  </div>
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
            <div className="h-full flex flex-col">
              {/* Code view header with back button */}
              {!isMobile && onToggleView && isPreviewable && (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDesktopCodeView(desktopCodeView === 'terminal' ? 'files' : 'terminal')}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Terminal className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {/* Code view header without back button for non-previewable projects */}
              {!isMobile && !isPreviewable && (
                <div className="h-12 px-4 border-b flex items-center bg-gradient-to-r from-muted/20 to-background">
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDesktopCodeView(desktopCodeView === 'terminal' ? 'files' : 'terminal')}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Terminal className="h-4 w-4" />
                  </Button>
                  <GitStatusIndicator projectId={projectId} />
                </div>
              )}

              <div className="flex-1 flex min-h-0">
                {desktopCodeView === 'terminal' ? (
                  <div className="flex-1">
                    <TerminalComponent cwd={`${projectsPath}/${projectId}`} />
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Deploy Dialog */}
      {projectName && (
        <DeployDialog
          projectId={projectId}
          projectName={projectName}
          open={deployDialogOpen}
          onOpenChange={setDeployDialogOpen}
        />
      )}
    </div>
  );
}