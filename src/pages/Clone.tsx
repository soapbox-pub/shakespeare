import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { GitBranch, Loader2, AlertCircle } from 'lucide-react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useToast } from '@/hooks/useToast';

import { useSeoMeta } from '@unhead/react';

export default function Clone() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { toast } = useToast();

  useSeoMeta({
    title: 'Import Repository - Shakespeare',
    description: 'Import a Git repository into your Shakespeare workspace',
  });

  const extractRepoName = (url: string): string => {
    try {
      // Handle different URL formats
      const cleanUrl = url.trim();

      // Extract from GitHub URLs, GitLab URLs, etc.
      const match = cleanUrl.match(/\/([^/]+?)(?:\.git)?(?:\/)?$/);
      if (match && match[1]) {
        return match[1];
      }

      // Fallback: use the last part of the URL
      const parts = cleanUrl.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      return lastPart.replace('.git', '') || 'imported-repo';
    } catch {
      return 'imported-repo';
    }
  };

  const validateGitUrl = (url: string): boolean => {
    if (!url.trim()) return false;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return false;
    }

    // Check if it looks like a git repository URL
    const gitUrlPattern = /^https?:\/\/.*\.git$|^https?:\/\/github\.com\/.*\/.*$|^https?:\/\/gitlab\.com\/.*\/.*$/i;
    return gitUrlPattern.test(url) || url.includes('github.com') || url.includes('gitlab.com');
  };

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    if (!validateGitUrl(repoUrl)) {
      setError('Please enter a valid Git repository URL (e.g., https://github.com/user/repo.git)');
      return;
    }

    setIsCloning(true);
    setError(null);

    try {
      // Extract repository name from URL
      const repoName = extractRepoName(repoUrl);

      // Clone the repository using ProjectsManager
      await projectsManager.init();
      const project = await projectsManager.cloneProject(repoName, repoUrl.trim());

      toast({
        title: "Repository imported successfully",
        description: `"${repoName}" has been cloned and is ready for development.`,
      });

      // Navigate to the new project
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error('Failed to clone repository:', error);

      let errorMessage = 'Failed to clone repository';
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          errorMessage = 'Repository not found. Please check the URL and try again.';
        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
          errorMessage = 'Access denied. The repository may be private or require authentication.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);

      toast({
        title: "Failed to import repository",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCloning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCloning) {
      handleClone();
    }
  };

  return (
    <AppLayout title="Import Repository">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">
            <GitBranch className="h-12 w-12 mx-auto text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Import Repository
          </h1>
          <p className="text-lg text-muted-foreground">
            Clone a Git repository into your Shakespeare workspace
          </p>
        </div>

        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Repository URL</CardTitle>
            <CardDescription className="text-base">
              Enter the HTTPS URL of the Git repository you want to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-url">Git Repository URL</Label>
              <Input
                id="repo-url"
                type="url"
                placeholder="https://github.com/username/repository.git"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setError(null); // Clear error when user types
                }}
                onKeyDown={handleKeyDown}
                disabled={isCloning}
                className="text-base"
              />
              <p className="text-sm text-muted-foreground">
                Supports GitHub, GitLab, and other Git hosting services
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              onClick={handleClone}
              disabled={!repoUrl.trim() || isCloning}
              className="w-full focus-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
              size="lg"
            >
              {isCloning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cloning Repository...
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Import Repository
                </>
              )}
            </Button>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">Supported Repository Types</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Public GitHub repositories</li>
                <li>• Public GitLab repositories</li>
                <li>• Any public Git repository accessible via HTTPS</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Note: Private repositories requiring authentication are not currently supported.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}