import { useState, useEffect, useCallback } from 'react';
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

export function PreviewPane({ projectId, activeTab }: PreviewPaneProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasBuiltProject, setHasBuiltProject] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');

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

  const checkForBuiltProject = useCallback(async () => {
    try {
      const exists = await fsManager.fileExists(projectId, 'dist/index.html');
      setHasBuiltProject(exists);

      if (exists) {
        // Load the built HTML content
        const htmlContent = await fsManager.readFile(projectId, 'dist/index.html');

        // Process the HTML to handle relative asset paths
        const processedHtml = await processHtmlForPreview(htmlContent, projectId);
        setPreviewHtml(processedHtml);
      }
    } catch (error) {
      console.error('Failed to check for built project:', error);
      setHasBuiltProject(false);
    }
  }, [projectId]);

  const processHtmlForPreview = async (html: string, projectId: string): Promise<string> => {
    try {
      // Create a temporary DOM to process the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Process script tags with relative paths
      const scripts = doc.querySelectorAll('script[src]');
      for (const script of scripts) {
        const src = script.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('//')) {
          try {
            const assetPath = src.startsWith('/') ? `dist${src}` : `dist/${src}`;
            const assetContent = await fsManager.readFile(projectId, assetPath);

            // Replace the script tag with inline script
            const inlineScript = doc.createElement('script');
            inlineScript.textContent = assetContent;
            script.parentNode?.replaceChild(inlineScript, script);
          } catch (error) {
            console.warn(`Failed to load script asset: ${src}`, error);
          }
        }
      }

      // Process CSS link tags
      const links = doc.querySelectorAll('link[rel="stylesheet"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('//')) {
          try {
            const assetPath = href.startsWith('/') ? `dist${href}` : `dist/${href}`;
            const cssContent = await fsManager.readFile(projectId, assetPath);

            // Replace the link tag with inline style
            const style = doc.createElement('style');
            style.textContent = cssContent;
            link.parentNode?.replaceChild(style, link);
          } catch (error) {
            console.warn(`Failed to load CSS asset: ${href}`, error);
          }
        }
      }

      return doc.documentElement.outerHTML;
    } catch (error) {
      console.error('Failed to process HTML for preview:', error);
      return html; // Return original HTML if processing fails
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
                srcDoc={previewHtml}
                className="w-full flex-1 border-0"
                title="Project Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
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