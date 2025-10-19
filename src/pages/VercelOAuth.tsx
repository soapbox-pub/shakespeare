import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVercelOAuth } from '@/hooks/useVercelOAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';

export default function VercelOAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useVercelOAuth();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const storedState = localStorage.getItem('vercel_oauth_state');

    // Handle OAuth errors
    if (error) {
      toast({
        title: "Vercel OAuth Error",
        description: errorDescription || error,
        variant: "destructive",
      });
      navigate('/settings/deploy');
      return;
    }

    // Handle successful OAuth callback
    if (code && state && storedState) {
      handleCallback(code, state).then((success) => {
        if (success) {
          toast({
            title: "Vercel Connected",
            description: "Successfully connected to Vercel. You can now deploy your projects.",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to Vercel. Please try again.",
            variant: "destructive",
          });
        }
        // Always redirect to Deploy settings after handling the callback
        navigate('/settings/deploy');
      });
    } else {
      // No code or state parameters - redirect to Deploy settings
      navigate('/settings/deploy');
    }
  }, [searchParams, handleCallback, toast, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 px-8 text-center">
          <div className="space-y-6">
            <div className="flex justify-center">
              <svg className="h-12 w-12 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1.5L24 22.5H0L12 1.5z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Connecting to Vercel</h1>
              <p className="text-muted-foreground">
                Processing your Vercel authentication...
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
