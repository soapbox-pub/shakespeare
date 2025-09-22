import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMutation } from '@tanstack/react-query';
import { deployProject } from '@/lib/deploy';
import { useFS } from '@/hooks/useFS';
import {
  CloudUpload,
  Loader2,
} from 'lucide-react';

interface DeployDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFirstInteraction?: () => void;
}

export function DeployDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  onFirstInteraction
}: DeployDialogProps) {
  const { config } = useAppContext();
  const { user } = useCurrentUser();
  const { fs } = useFS();
  const { toast } = useToast();

  // State for the deploy URL input
  const [deployUrl, setDeployUrl] = useState('');

  // Initialize deploy URL when dialog opens
  useEffect(() => {
    if (open) {
      setDeployUrl(`${projectId}.${config.deployServer}`);
    }
  }, [open, projectId, config.deployServer]);

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be logged into Nostr to deploy a project");
      }

      // Parse the deploy URL to extract hostname and server
      const hostname = deployUrl.trim();
      const parts = hostname.split('.');

      if (parts.length < 2) {
        throw new Error("Invalid deploy URL format. Please use format: subdomain.domain.com");
      }

      // Extract the deploy server (everything after the first dot)
      const deployServer = parts.slice(1).join('.');

      return await deployProject({
        fs,
        projectId, // Keep the original projectId for file path
        deployServer,
        projectPath: `/projects/${projectId}`,
        signer: user.signer,
        customHostname: hostname, // Pass the custom hostname
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Deployment successful!",
        description: `Your project is now live at ${result.hostname}`,
      });

      // Open the deployed site in a new tab
      window.open(result.url, '_blank');

      // Close the dialog
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Deployment failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const handleDeploy = () => {
    if (onFirstInteraction) {
      onFirstInteraction();
    }
    deployMutation.mutate();
  };

  const handleUrlChange = (value: string) => {
    // Remove protocol if user enters it
    const cleanValue = value.replace(/^https?:\/\//, '');
    setDeployUrl(cleanValue);
  };

  const isValidUrl = () => {
    const trimmed = deployUrl.trim();
    return trimmed.length > 0 && trimmed.includes('.') && !trimmed.startsWith('.') && !trimmed.endsWith('.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5" />
            Deploy "{projectName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deploy-url">Deploy URL</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                https://
              </span>
              <Input
                id="deploy-url"
                value={deployUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={`${projectId}.${config.deployServer}`}
                className="pl-16"
                disabled={deployMutation.isPending}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your project will be deployed to this URL. You can customize the subdomain.
            </p>
          </div>

          {!user && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                You must be logged into Nostr to deploy projects.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deployMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={!user || !isValidUrl() || deployMutation.isPending}
            className="gap-2"
          >
            {deployMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            {deployMutation.isPending ? 'Deploying...' : 'Deploy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}