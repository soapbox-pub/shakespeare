import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AppLayout } from '@/components/AppLayout';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';

export default function Index() {
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [storedPrompt, setStoredPrompt] = useLocalStorage('shakespeare-draft-prompt', '');
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { user: _user } = useCurrentUser();

  useSeoMeta({
    title: 'Shakespeare - AI-Powered Nostr Development',
    description: 'Build custom Nostr websites with AI assistance using Shakespeare, an AI-powered development environment.',
  });

  // Restore prompt from local storage on mount
  useEffect(() => {
    if (storedPrompt) {
      setPrompt(storedPrompt);
    }
  }, [storedPrompt]);

  // Sync prompt with local storage
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    setStoredPrompt(newPrompt);
  };

  const handleCreateProject = async () => {
    if (!prompt.trim()) return;

    // Clear stored prompt when creating project
    setStoredPrompt('');

    setIsCreating(true);
    try {
      const project = await projectsManager.createProject(prompt.trim());
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const headerContent = null;

  return (
    <>
      <AppLayout headerContent={headerContent}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <div className="text-4xl md:text-6xl mb-4 md:mb-6">🎭</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Build Nostr apps with AI
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              What would you like to build?
            </p>
          </div>

          <div className="mb-8 md:mb-12">
            {/* Chat Input Container - matching the ChatPane style */}
            <div className="relative rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all">
              <Textarea
                placeholder="e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies..."
                value={prompt}
                onChange={handlePromptChange}
                className="min-h-[120px] max-h-64 resize-none border-0 bg-transparent px-4 py-3 pb-16 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                disabled={isCreating}
                rows={4}
                style={{
                  height: 'auto',
                  minHeight: '120px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 256) + 'px';
                }}
              />

              {/* Bottom Controls Row */}
              <div className="absolute bottom-3 right-3">
                <Button
                  onClick={handleCreateProject}
                  disabled={!prompt.trim() || isCreating}
                  size="sm"
                  className="h-8 rounded-lg"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-3 w-3" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </>
  );
}