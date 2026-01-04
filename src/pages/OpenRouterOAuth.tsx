import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useOpenRouterOAuth } from '@/hooks/useOpenRouterOAuth';
import { useAISettings } from '@/hooks/useAISettings';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export default function OpenRouterOAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useOpenRouterOAuth();
  const { isLoading: isSettingsLoading } = useAISettings();
  const { toast } = useToast();

  useEffect(() => {
    // Wait for AI settings to be initialized
    if (isSettingsLoading) {
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const storedCodeVerifier = localStorage.getItem('openrouter_oauth_code_verifier');

    // Handle OAuth errors
    if (error) {
      toast({
        title: "OpenRouter OAuth Error",
        description: errorDescription || error,
        variant: "destructive",
      });
      navigate('/settings/ai');
      return;
    }

    // Handle successful OAuth callback
    if (code && storedCodeVerifier) {
      handleCallback(code, state || '').then((success) => {
        if (success) {
          toast({
            title: "OpenRouter Connected",
            description: "Successfully connected to OpenRouter. You can now use OpenRouter models.",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to OpenRouter. Please try again.",
            variant: "destructive",
          });
        }
        // Always redirect to AI settings after handling the callback
        navigate('/settings/ai');
      });
    } else if (code && !storedCodeVerifier) {
      // Missing code verifier - likely an incomplete PKCE flow
      toast({
        title: "Authentication Error",
        description: "OAuth flow is incomplete. Please try connecting to OpenRouter again.",
        variant: "destructive",
      });
      // Clean up any remaining OAuth data
      localStorage.removeItem('openrouter_oauth_state');
      localStorage.removeItem('openrouter_oauth_code_verifier');
      navigate('/settings/ai');
    } else {
      // No code parameter - redirect to AI settings
      navigate('/settings/ai');
    }
  }, [searchParams, handleCallback, toast, navigate, isSettingsLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 px-8 text-center">
          <div className="space-y-6">
            <div className="flex justify-center">
              <Bot className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Connecting to OpenRouter</h1>
              <p className="text-muted-foreground">
                Processing your OpenRouter authentication...
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
