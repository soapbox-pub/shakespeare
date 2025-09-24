import { useState, useCallback } from 'react';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { createAIClient } from '@/lib/ai-client';
import { parseProviderModel } from '@/lib/parseProviderModel';

interface UseAIProjectIdOptions {
  onError?: (error: string) => void;
}

export function useAIProjectId({ onError }: UseAIProjectIdOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const { settings, isConfigured } = useAISettings();
  const { user } = useCurrentUser();
  const projectsManager = useProjectsManager();

  const generateProjectId = useCallback(async (providerModel: string, prompt: string): Promise<string> => {
    if (!isConfigured) {
      throw new Error('AI settings not configured');
    }

    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    setIsLoading(true);

    try {
      // Initialize OpenAI client
      const { model, provider } = parseProviderModel(providerModel, settings.providers);
      const openai = createAIClient(provider, user);

      const systemPrompt = `You are a product expert. Given the user's project description, come up with a short, unique, and memorable name for their product or brand. Generate only the name without any additional text or punctuation. The name should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens. Avoid using special characters or underscores.`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: prompt }
      ];

      // Try once to generate a project name
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 1,
      });

      const projectId = completion.choices[0]?.message?.content?.trim();
      if (!projectId) {
        throw new Error('Failed to generate project name');
      }

      // Validate the generated ID directly (no conversion)
      const validIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (projectId.length <= 50 && validIdRegex.test(projectId)) {
        // Check if project exists
        const existingProject = await projectsManager.getProject(projectId);
        if (existingProject === null) {
          // Valid and unique project ID
          return projectId;
        }
      }

      // If we reach here, either the regex failed or the project already exists
      // Fall back to "untitled" with number suffixes
      let fallbackId = 'untitled';
      let counter = 1;

      // Check if base "untitled" exists
      let existingProject = await projectsManager.getProject(fallbackId);

      // Keep incrementing until we find an available name
      while (existingProject !== null) {
        fallbackId = `untitled-${counter}`;
        existingProject = await projectsManager.getProject(fallbackId);
        counter++;
      }

      return fallbackId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate project ID';
      onError?.(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, settings, onError, user, projectsManager]);

  return {
    generateProjectId,
    isLoading,
    isConfigured
  };
}