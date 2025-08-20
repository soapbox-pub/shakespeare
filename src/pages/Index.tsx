import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AppLayout } from '@/components/AppLayout';
import { OnboardingDialog } from '@/components/onboarding';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Sparkles } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';

export default function Index() {
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [storedPrompt, setStoredPrompt] = useLocalStorage('shakespeare-draft-prompt', '');
  const navigate = useNavigate();
  const projectsManager = useProjectsManager();
  const { user: _user } = useCurrentUser();
  const {
    hasCompletedOnboarding,
    currentStep,
    isOnboardingOpen,
    setIsOnboardingOpen,
    handleNextStep,
    handlePreviousStep,
    handleCompleteOnboarding,
  } = useOnboarding();

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

  const headerContent = (
    <>
      {hasCompletedOnboarding && (
        <Button
          onClick={() => setIsOnboardingOpen(true)}
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Restart Onboarding
        </Button>
      )}
    </>
  );

  return (
    <>
      <AppLayout headerContent={headerContent}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <div className="text-4xl md:text-6xl mb-4 md:mb-6">🎭</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Shakespeare
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-2">
              Build custom Nostr websites with AI assistance
            </p>
            <p className="text-sm text-muted-foreground">
              <a href="https://soapbox.pub/mkstack" className="hover:underline focus-ring text-primary">
                Vibed with MKStack
              </a>
            </p>
            {hasCompletedOnboarding && (
              <Button
                onClick={() => setIsOnboardingOpen(true)}
                variant="ghost"
                size="sm"
                className="mt-4 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Restart Onboarding
              </Button>
            )}
          </div>

          <div className="mb-8 md:mb-12">
            <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Plus className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Create a New Project</CardTitle>
                    <CardDescription className="text-base">
                      Describe what kind of Nostr website you want to build
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies..."
                  value={prompt}
                  onChange={handlePromptChange}
                  className="min-h-[120px] touch-action-manipulation overscroll-contain text-base leading-relaxed"
                  disabled={isCreating}
                />
                <Button
                  onClick={handleCreateProject}
                  disabled={!prompt.trim() || isCreating}
                  className="w-full focus-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg"
                  size="lg"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Project...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Project
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>

      <OnboardingDialog
        open={isOnboardingOpen}
        onOpenChange={setIsOnboardingOpen}
        currentStep={currentStep}
        onNextStep={handleNextStep}
        onPreviousStep={handlePreviousStep}
        onComplete={handleCompleteOnboarding}
        initialPrompt={storedPrompt}
        onProjectCreated={(projectId) => {
          console.log('Project created during onboarding:', projectId);
          setStoredPrompt('');
        }}
      />
    </>
  );
}