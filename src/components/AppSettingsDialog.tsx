import { useState, useEffect } from 'react';
import { Settings, Save, Database, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppContext } from '@/hooks/useAppContext';
import { useToast } from '@/hooks/useToast';

interface AppSettingsDialogProps {
  children?: React.ReactNode;
}

export function AppSettingsDialog({ children }: AppSettingsDialogProps) {
  const { config, updateConfig } = useAppContext();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deployServer, setDeployServer] = useState(config.deployServer);
  const [filesystemType, setFilesystemType] = useState(config.filesystemType);
  const [opfsAvailable, setOpfsAvailable] = useState(false);

  // Check OPFS availability on mount
  useEffect(() => {
    const checkOPFSAvailability = () => {
      const available = 'storage' in navigator && !!((navigator.storage as unknown as { getDirectory: () => FileSystemDirectoryHandle }).getDirectory);
      setOpfsAvailable(available);
    };

    checkOPFSAvailability();
  }, []);

  const handleSave = () => {
    // Validate deploy server
    if (!deployServer.trim()) {
      toast({
        title: "Invalid deploy server",
        description: "Deploy server cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    // Validate filesystem type
    if (filesystemType === 'opfs' && !opfsAvailable) {
      toast({
        title: "OPFS not available",
        description: "OPFS is not supported in your browser. Please use LightningFS instead.",
        variant: "destructive",
      });
      return;
    }

    // Remove protocol if present
    const cleanDeployServer = deployServer.replace(/^https?:\/\//, '');

    updateConfig((current) => ({
      ...current,
      deployServer: cleanDeployServer,
      filesystemType,
    }));

    toast({
      title: "Settings saved",
      description: "Your settings have been updated. The page will refresh to apply the new filesystem.",
    });

    // Refresh the page to apply filesystem changes
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    setOpen(false);
  };

  const handleCancel = () => {
    // Reset to current config
    setDeployServer(config.deployServer);
    setFilesystemType(config.filesystemType);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>App Settings</DialogTitle>
          <DialogDescription>
            Configure your application preferences and deployment settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filesystem Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Filesystem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Filesystem Type</Label>
                <RadioGroup
                  value={filesystemType}
                  onValueChange={(value) => setFilesystemType(value as 'lightningfs' | 'opfs')}
                  className="grid grid-cols-1 gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="lightningfs" id="lightningfs" />
                    <Label htmlFor="lightningfs" className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-medium">LightningFS (IndexedDB)</span>
                        <span className="text-sm text-muted-foreground">
                          Uses IndexedDB for storage. Works in all modern browsers.
                        </span>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="opfs"
                      id="opfs"
                      disabled={!opfsAvailable}
                    />
                    <Label htmlFor="opfs" className={`cursor-pointer ${!opfsAvailable ? 'opacity-50' : ''}`}>
                      <div className="flex flex-col">
                        <span className="font-medium flex items-center gap-2">
                          OPFS (Origin Private File System)
                          {!opfsAvailable && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {opfsAvailable
                            ? "Modern browser API with better performance and larger storage limits."
                            : "Not available in this browser. Use Chrome, Edge, or Firefox 111+."
                          }
                        </span>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {!opfsAvailable && filesystemType === 'opfs' && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm text-orange-800 dark:text-orange-200">
                    OPFS is not available in your browser. Please use LightningFS or upgrade to a modern browser.
                  </span>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <p><strong>Note:</strong> Changing the filesystem type will refresh the page and may cause data loss if not properly exported first.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deployServer">Deploy Server</Label>
                <Input
                  id="deployServer"
                  value={deployServer}
                  onChange={(e) => setDeployServer(e.target.value)}
                  placeholder="shakespeare.wtf"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Your projects will be deployed to subdomains of this server.
                  Example: yourproject.{deployServer || 'shakespeare.wtf'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}