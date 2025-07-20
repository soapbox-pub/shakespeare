import { useState, useEffect, useCallback, useRef } from 'react';
import { fsManager } from '@/lib/fs';
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
  params: { path: string };
  id: number;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: {
    content: string;
    contentType: string;
  };
  error?: {
    code: number;
    message: string;
    data?: { path: string };
  };
  id: number;
}

export function PreviewPane({ projectId, activeTab }: PreviewPaneProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasBuiltProject, setHasBuiltProject] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadFileContent = useCallback(async (filePath: string) => {
    setIsLoading(true);
    try {
      const content = await fsManager.readFile(projectId, filePath);
      setFileContent(content);
    } catch (_error) {
      console.error('Failed to load file:', _error);
      setFileContent('');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

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
      const exists = await fsManager.fileExists(projectId, 'dist/index.html');
      setHasBuiltProject(exists);
    } catch (error) {
      console.error('Failed to check for built project:', error);
      setHasBuiltProject(false);
    }
  }, [projectId]);

  const handleReadFile = useCallback(async (request: JSONRPCRequest) => {
    const { params, id } = request;
    const { path } = params;

    console.log(`Preview iframe requesting file: ${path}`);
    
    try {
      const file = await fsManager.readFile(projectId, 'dist' + path);
      console.log(`Serving file: ${path}`);
      sendResponse({
        jsonrpc: '2.0',
        result: {
          content: file,
          contentType: getContentType(path),
        },
        id
      });
    } catch {
      console.log(`File not found: ${path}`);
      sendError({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'File not found',
          data: { path }
        },
        id
      });
    }
  }, [projectId]);

  // Setup messaging protocol for iframe communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== 'https://delicate-snowflake-b476.gleasonator.workers.dev') {
        return;
      }

      const message = event.data;
      console.log('Received message from iframe:', message);
      if (message.jsonrpc === '2.0' && message.method === 'readFile') {
        handleReadFile(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleReadFile]);

  const sendResponse = (message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {
      console.log(`Sending response to iframe:`, message);
      iframeRef.current.contentWindow.postMessage(
        message,
        'https://delicate-snowflake-b476.gleasonator.workers.dev'
      );
    }
  };

  const sendError = (message: JSONRPCResponse) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        message,
        'https://delicate-snowflake-b476.gleasonator.workers.dev'
      );
    }
  };

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
      await fsManager.fs.promises.writeFile(`/projects/${projectId}/${selectedFile}`, content);
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
                  onClick={checkForBuiltProject}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <iframe
                ref={iframeRef}
                src="https://delicate-snowflake-b476.gleasonator.workers.dev/"
                className="w-full flex-1 border-0"
                title="Project Preview"
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