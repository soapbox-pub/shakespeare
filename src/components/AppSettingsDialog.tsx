import { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

    // Remove protocol if present
    const cleanDeployServer = deployServer.replace(/^https?:\/\//, '');

    updateConfig((current) => ({
      ...current,
      deployServer: cleanDeployServer,
    }));

    toast({
      title: "Settings saved",
      description: "Your deployment settings have been updated.",
    });

    setOpen(false);
  };

  const handleCancel = () => {
    // Reset to current config
    setDeployServer(config.deployServer);
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