import { useState, useEffect } from 'react';
import { fsManager } from '@/lib/fs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
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

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, projectId]);

  const loadFileContent = async (filePath: string) => {
    setIsLoading(true);
    try {
      const content = await fsManager.readFile(projectId, filePath);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to load file:', error);
      setFileContent('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
  };

  const handleFileSave = async (content: string) => {
    if (!selectedFile) return;
    
    try {
      await fsManager.writeFile(projectId, selectedFile, content);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  return (
    <div className="h-full">
      <Tabs value={activeTab} className="h-full">
        <TabsContent value="preview" className="h-full mt-0">
          <div className="h-full flex items-center justify-center bg-muted">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Project Preview</h3>
              <p className="text-muted-foreground mb-4">
                Your project will be built and displayed here
              </p>
              <div className="bg-background border rounded-lg p-8 max-w-md">
                <p className="text-sm text-muted-foreground">
                  Vite build integration coming soon...
                </p>
              </div>
            </div>
          </div>
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