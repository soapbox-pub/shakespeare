import { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectsManager } from '@/lib/fs';
import { useFS } from '@/hooks/useFS';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

import { FileTree } from './FileTree';
import { FileEditor } from './FileEditor';

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
  };
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
  id: number;
}

export function PreviewPane({ projectId, activeTab }: PreviewPaneProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasBuiltProject, setHasBuiltProject] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { fs } = useFS();
  const projectsManager = new ProjectsManager(fs);

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
      console.log(`Sending response to iframe:`, message);
      const targetOrigin = `https://${projectId}.local-shakespeare.dev`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId]);

  const sendError = useCallback((message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {
      const targetOrigin = `https://${projectId}.local-shakespeare.dev`;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
    }
  }, [projectId]);

  const handleFetch = useCallback(async (request: JSONRPCRequest) => {
    const { params, id } = request;
    const { request: fetchRequest } = params;

    console.log(`Preview iframe requesting: ${fetchRequest.url}`);

    try {
      // Parse the URL and validate origin
      const url = new URL(fetchRequest.url);
      const expectedOrigin = `https://${projectId}.local-shakespeare.dev`;

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
        const file = await projectsManager.readFile(projectId, 'dist' + filePath);
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
            body: file,
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
        const indexFile = await projectsManager.readFile(projectId, 'dist/index.html');
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
            body: indexFile,
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
            body: `File not found: ${path}`,
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
      const expectedOrigin = `https://${projectId}.local-shakespeare.dev`;
      if (event.origin !== expectedOrigin) {
        console.log(`Ignoring message from unexpected origin: ${event.origin}, expected: ${expectedOrigin}`);
        return;
      }

      const message = event.data;
      console.log('Received message from iframe:', message);
      if (message.jsonrpc === '2.0' && message.method === 'fetch') {
        handleFetch(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleFetch, projectId]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, loadFileContent]);

  useEffect(() => {
    checkForBuiltProject();
  }, [checkForBuiltProject]);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
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

  return (
    <div className="h-full">
      <Tabs value={activeTab} className="h-full">
        <TabsContent value="preview" className="h-full mt-0">
          {hasBuiltProject ? (
            <div className="h-full w-full flex flex-col">
              <div className="flex items-center justify-between p-2 border-b bg-background">
                <span className="text-sm text-muted-foreground">Project Preview</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshIframe}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <iframe
                ref={iframeRef}
                src={`https://${projectId}.local-shakespeare.dev/`}
                className="w-full flex-1 border-0"
                title="Project Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-muted">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Project Preview</h3>
                <p className="text-muted-foreground mb-4">
                  Build your project to see the preview here
                </p>
                <div className="bg-background border rounded-lg p-8 max-w-md">
                  <p className="text-sm text-muted-foreground mb-4">
                    Run the build command to generate <code className="bg-muted px-1 rounded">dist/index.html</code>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkForBuiltProject}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Check for Build
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="code" className="h-full mt-0">
          <div className="h-full flex">
            <div className="w-1/3 border-r">
              <div className="p-4 border-b">
                <h3 className="font-semibold">File Explorer</h3>
              </div>
              <ScrollArea className="h-[calc(100%-60px)]">
                <FileTree
                  projectId={projectId}
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                />
              </ScrollArea>
            </div>

            <div className="flex-1">
              {selectedFile ? (
                <FileEditor
                  filePath={selectedFile}
                  content={fileContent}
                  onSave={handleFileSave}
                  isLoading={isLoading}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground">
                      Select a file from the explorer to edit
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}