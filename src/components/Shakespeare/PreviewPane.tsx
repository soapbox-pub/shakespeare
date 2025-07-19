import { useState, useEffect } from 'react';
import { fsManager } from '@/lib/fs';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

import { FileTree } from './FileTree';
import { FileEditor } from './FileEditor';
import { getPublicKey, nip19 } from 'nostr-tools';

interface PreviewPaneProps {
  projectId: string;
  activeTab: 'preview' | 'code';
}

export function PreviewPane({ projectId, activeTab }: PreviewPaneProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [projectUrl, setProjectUrl] = useState('');

  useEffect(() => {
    (async () => {
      const project = await fsManager.getProject(projectId);
      if (!project) return;

      const decoded = nip19.decode(project.nsec);
      if (decoded.type !== 'nsec') return;

      const pubkey = getPublicKey(decoded.data);
      const npub = nip19.npubEncode(pubkey);

      setProjectUrl(`https://${npub}.nostrdeploy.com/`);
    })();
  }, [projectId]);

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
          {projectUrl ? (
            <div className="h-full w-full flex flex-col">
              <div className="flex items-center justify-between p-2 border-b bg-background">
                <span className="text-sm text-muted-foreground">Project Preview</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {}}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <iframe
                src={projectUrl}
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
                    onClick={() => {}}
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
                  isLoading={false} // Replace with actual loading state if needed
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