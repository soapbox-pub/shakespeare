import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useNetlifyOAuth } from '@/hooks/useNetlifyOAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';

export default function NetlifyOAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useNetlifyOAuth();
  const { toast } = useToast();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const storedState = localStorage.getItem('netlify_oauth_state');

    // Handle OAuth errors
    if (error) {
      toast({
        title: "Netlify OAuth Error",
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
            title: "Netlify Connected",
            description: "Successfully connected to Netlify. You can now deploy your projects.",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to Netlify. Please try again.",
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
                <path d="M16.934 8.519a1.044 1.044 0 0 1 .303.23l2.349 2.348a1 1 0 0 1 0 1.414l-2.348 2.349a1.044 1.044 0 0 1-.231.303 1.042 1.042 0 0 1-1.473-1.473l.527-.527H11a1 1 0 1 1 0-2h5.061l-.527-.527a1.042 1.042 0 0 1 1.4-1.517zM7.066 15.481a1.044 1.044 0 0 1-.303-.23l-2.349-2.348a1 1 0 0 1 0-1.414l2.348-2.349a1.044 1.044 0 0 1 .231-.303 1.042 1.042 0 0 1 1.473 1.473l-.527.527H13a1 1 0 0 1 0 2H7.939l.527.527a1.042 1.042 0 0 1-1.4 1.517z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Connecting to Netlify</h1>
              <p className="text-muted-foreground">
                Processing your Netlify authentication...
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
