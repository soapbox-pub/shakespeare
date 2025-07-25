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
}

export function ProjectStep({ onPrevious, onComplete, onProjectCreated }: ProjectStepProps) {
  const [prompt, setPrompt] = useState('');
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
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Create Your First Project
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          Our AI will help you create it step by step.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Project Description</CardTitle>
          </div>
          <CardDescription>
            Be as detailed as possible about what you want to build
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g., Create a farming equipment marketplace for local farmers to buy and sell tractors, tools, and supplies. Include user profiles, product listings with images, search functionality, and direct messaging between buyers and sellers..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[125px] text-sm leading-relaxed"
            disabled={isCreating}
          />

          <div className="space-y-2">
            <h3 className="font-medium text-sm">Example prompts:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• "Build a social media platform for photographers to share their work and connect with clients"</li>
              <li>• "Create a blog platform with markdown support and Nostr-based comments"</li>
              <li>• "Design a marketplace for vintage clothing with categories, filters, and user ratings"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-3 pt-2">
        <Button
          onClick={onPrevious}
          variant="outline"
          size="sm"
          className="gap-1 h-8 text-sm"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Button>
        <Button
          onClick={handleCreateProject}
          disabled={!prompt.trim() || isCreating}
          size="sm"
          className="gap-1 h-8 text-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
        >
          {isCreating ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Create Project
            </>
          )}
        </Button>
      </div>
    </div>
  );
}