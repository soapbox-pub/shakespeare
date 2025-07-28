import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { useNavigate } from 'react-router-dom';

interface ProjectStepProps {
  onNext: () => void;
  onPrevious: () => void;
  onComplete: () => void;
  onProjectCreated?: (projectId: string) => void;
  initialPrompt?: string;
}

export function ProjectStep({ onPrevious, onComplete, onProjectCreated, initialPrompt = '' }: ProjectStepProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isCreating, setIsCreating] = useState(false);
  const projectsManager = useProjectsManager();
  const navigate = useNavigate();

  const handleCreateProject = async () => {
    if (!prompt.trim()) return;

    setIsCreating(true);
    try {
      const project = await projectsManager.createProject(prompt.trim());
      onProjectCreated?.(project.id);
      onComplete();
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6 pb-4">
      <div className="text-center space-y-1 sm:space-y-4">
        <div className="flex justify-center mb-0.5 sm:mb-2">
          <Sparkles className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
        </div>
        <h1 className="text-base sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
          Create Your First Project
        </h1>
        <p className="text-xs sm:text-base text-muted-foreground max-w-md sm:max-w-2xl mx-auto px-2">
          Our AI will help you create it step by step.
        </p>
      </div>

      <Card className="max-w-md sm:max-w-2xl md:max-w-2xl mx-auto">
        <CardHeader className="pb-3 sm:pb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">Project Description</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Be as detailed as possible about what you want to build
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <Textarea
            placeholder="e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies. Include user profiles, product listings with images, search functionality, and direct messaging between buyers and sellers..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[175px] sm:min-h-[100px] sm:min-h-[125px] text-xs sm:text-sm leading-relaxed"
            disabled={isCreating}
          />

          <div className="hidden sm:block space-y-1.5 sm:space-y-2">
            <h3 className="font-medium text-xs sm:text-sm">Example prompts:</h3>
            <ul className="text-[10px] sm:text-xs text-muted-foreground space-y-0.5 sm:space-y-1">
              <li>• "Build a social media platform for photographers"</li>
              <li>• "Create a blog with markdown and Nostr comments"</li>
              <li>• "Design a marketplace with categories and ratings"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-2 pt-2 sm:pt-4">
        <Button
          onClick={handleCreateProject}
          disabled={!prompt.trim() || isCreating}
          size="lg"
          className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
        >
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Project
            </>
          )}
        </Button>
        <Button
          onClick={onPrevious}
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs h-7"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Button>
      </div>
    </div>
  );
}