import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGitHubOAuth } from '@/hooks/useGitHubOAuth';
import { InfoIcon, KeyRound, ExternalLink } from 'lucide-react';

interface AuthStepProps {
  host: string;
  onComplete: (host: string, token: string, username?: string) => void;
}

export function AuthStep({ host, onComplete }: AuthStepProps) {
  const { isOAuthConfigured, initiateOAuth } = useGitHubOAuth();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');

  const handleTokenSubmit = () => {
    if (!token.trim()) return;
    onComplete(host, token.trim(), username.trim() || undefined);
  };

  const getTokenInstructions = () => {
    switch (host) {
      case 'github.com':
        return {
          url: 'https://github.com/settings/tokens/new',
          scopes: 'public_repo (for public repositories)',
          steps: [
            'Click "Generate new token (classic)"',
            'Set a descriptive note like "Shakespeare Contributions"',
            'Select the "public_repo" scope',
            'Click "Generate token" at the bottom',
            'Copy the token and paste it below',
          ],
        };
      case 'gitlab.com':
        return {
          url: 'https://gitlab.com/-/profile/personal_access_tokens',
          scopes: 'api or write_repository',
          steps: [
            'Enter a token name like "Shakespeare"',
            'Select the "api" or "write_repository" scope',
            'Click "Create personal access token"',
            'Copy the token and paste it below',
          ],
        };
      case 'codeberg.org':
        return {
          url: 'https://codeberg.org/user/settings/applications',
          scopes: 'repo',
          steps: [
            'Go to Applications > Access Tokens',
            'Click "Generate New Token"',
            'Enter a description like "Shakespeare"',
            'Select the "repo" permission',
            'Click "Generate Token"',
            'Copy the token and paste it below',
          ],
        };
      default:
        return {
          url: `https://${host}/user/settings/applications`,
          scopes: 'repo or write access',
          steps: [
            'Navigate to your user settings',
            'Find the access tokens or applications section',
            'Create a new token with repository write permissions',
            'Copy the token and paste it below',
          ],
        };
    }
  };

  const instructions = getTokenInstructions();
  const showOAuth = host === 'github.com' && isOAuthConfigured;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Connect to {host}</h3>
        <p className="text-sm text-muted-foreground">
          To propose changes, you need to authenticate with {host}
        </p>
      </div>

      <Tabs defaultValue={showOAuth ? 'oauth' : 'token'}>
        {showOAuth && (
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oauth">Quick Connect</TabsTrigger>
            <TabsTrigger value="token">Access Token</TabsTrigger>
          </TabsList>
        )}

        {showOAuth && (
          <TabsContent value="oauth" className="space-y-4 mt-4">
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                The fastest way to connect. You'll be redirected to {host} to authorize Shakespeare.
              </AlertDescription>
            </Alert>

            <Button onClick={initiateOAuth} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Connect with {host === 'github.com' ? 'GitHub' : host}
            </Button>
          </TabsContent>
        )}

        <TabsContent value="token" className="space-y-4 mt-4">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Create a personal access token on {host} with the following scope: <strong>{instructions.scopes}</strong>
            </AlertDescription>
          </Alert>

          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">How to create a token:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              {instructions.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <a
              href={instructions.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Open {host} token settings
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username (optional)</Label>
            <Input
              id="username"
              placeholder="your-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your username on {host} (helpful but not required)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Personal Access Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <KeyRound className="inline h-3 w-3 mr-1" />
              Your token is stored locally and never sent to Shakespeare servers
            </p>
          </div>

          <Button onClick={handleTokenSubmit} disabled={!token.trim()} className="w-full">
            Connect
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
