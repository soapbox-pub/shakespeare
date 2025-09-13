import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, AlertTriangle, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/useToast';
import { useFS } from '@/hooks/useFS';
import JSZip from 'jszip';

export function DataSettings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const { fs } = useFS();
  const navigate = useNavigate();

  const exportFilesAsZip = async () => {
    const zip = new JSZip();

    // Recursive function to add files and directories to zip
    const addToZip = async (dirPath: string, zipFolder: JSZip) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;

          if (entry.isDirectory()) {
            // Create folder in zip and recursively add its contents
            const folder = zipFolder.folder(entry.name);
            if (folder) {
              await addToZip(fullPath, folder);
            }
          } else if (entry.isFile()) {
            // Add file to zip
            try {
              const fileContent = await fs.readFile(fullPath);
              zipFolder.file(entry.name, fileContent);
            } catch (error) {
              console.warn(`Failed to read file ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${dirPath}:`, error);
      }
    };

    // Start from root directory
    await addToZip('/', zip);

    // Generate zip file
    const content = await zip.generateAsync({ type: 'blob' });

    // Create download link
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    link.download = `shakespeare-projects-${dateStr}.zip`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportFiles = async () => {
    setIsExporting(true);
    try {
      await exportFilesAsZip();

      toast({
        title: "Files exported successfully",
        description: "Your project files have been downloaded as a zip file.",
      });
    } catch (error) {
      console.error('Failed to export files:', error);
      toast({
        title: "Failed to export files",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      // Clear localStorage
      localStorage.clear();

      // Clear IndexedDB databases
      const databases = await indexedDB.databases();
      const deletePromises = databases.map(db => {
        if (db.name) {
          return new Promise<void>((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(db.name!);
            deleteReq.onsuccess = () => resolve();
            deleteReq.onerror = () => reject(deleteReq.error);
            deleteReq.onblocked = () => {
              console.warn(`Delete blocked for database: ${db.name}`);
              // Still resolve to continue with the process
              resolve();
            };
          });
        }
        return Promise.resolve();
      });

      await Promise.all(deletePromises);

      toast({
        title: "Data cleared successfully",
        description: "All local data has been removed. Redirecting to homepage...",
      });

      // Small delay to show the toast, then redirect
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast({
        title: "Failed to clear data",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          Data
        </h1>
        <p className="text-muted-foreground">
          Export your projects or clear all local data from this browser.
        </p>
      </div>

      <div className="space-y-4">
        {/* Export Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Files
            </CardTitle>
            <CardDescription>
              Download all your projects and files as a ZIP archive. This includes all project files, settings, and data stored locally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExportFiles}
              disabled={isExporting}
              className="w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Files
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Clear All Data */}
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Clear All Data
            </CardTitle>
            <CardDescription>
              Permanently delete all local data including projects, settings, and cached information. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isClearing}
                  className="w-full sm:w-auto"
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Data
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      This action will permanently delete all local data from this browser, including:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>All projects and their files</li>
                      <li>AI settings and API keys</li>
                      <li>Git credentials and settings</li>
                      <li>User preferences and themes</li>
                      <li>Cached data and session information</li>
                    </ul>
                    <p className="font-medium text-destructive">
                      This action cannot be undone. Consider exporting your files first.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, clear all data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DataSettings;