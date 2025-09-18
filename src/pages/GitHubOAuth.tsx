import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGitHubOAuth } from '@/hooks/useGitHubOAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { Github } from 'lucide-react';

export default function GitHubOAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useGitHubOAuth();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      toast({
        title: "GitHub OAuth Error",
        description: errorDescription || error,
        variant: "destructive",
      });
      navigate('/settings/git');
      return;
    }

    // Handle successful OAuth callback
    if (code && state) {
      handleCallback(code, state).then((success) => {
        if (success) {
          toast({
            title: "GitHub Connected",
            description: "Successfully connected to GitHub. You can now push and pull from GitHub repositories.",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to GitHub. Please try again.",
            variant: "destructive",
          });
        }
        // Always redirect to Git settings after handling the callback
        navigate('/settings/git');
      });
    } else {
      // No code or state parameters - redirect to Git settings
      navigate('/settings/git');
    }
  }, [searchParams, handleCallback, toast, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 px-8 text-center">
          <div className="space-y-6">
            <div className="flex justify-center">
              <Github className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Connecting to GitHub</h1>
              <p className="text-muted-foreground">
                Processing your GitHub authentication...
              </p>
            </div>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}