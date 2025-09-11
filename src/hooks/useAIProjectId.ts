import { useState, useCallback } from 'react';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createAIClient } from '@/lib/ai-client';
import { parseProviderModel } from '@/lib/parseProviderModel';

interface UseAIProjectIdOptions {
  onError?: (error: string) => void;
}

export function useAIProjectId({ onError }: UseAIProjectIdOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const { settings, isConfigured } = useAISettings();
  const { user } = useCurrentUser();

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
      const { model, connection } = parseProviderModel(providerModel, settings.providers);
      const openai = createAIClient(connection, user);

      const systemPrompt = `You are a product expert. Given the user's project description, come up with a short, unique, and memorable name for their product or brand. Generate only the name without any additional text or punctuation. The name should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens. Avoid using special characters or underscores.`;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 1,
      });

      const projectName = completion.choices[0]?.message?.content?.trim();
      if (!projectName) {
        throw new Error('Failed to generate project name');
      }

      // Convert the name into kebab-case
      const projectId = projectName
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '') // Remove invalid characters
        .replace(/-+/g, '-') // Replace multiple hyphens with a single hyphen
        .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end

      if (!projectId) {
        throw new Error('Generated project ID is empty after formatting');
      }

      // Validate the generated ID
      const validIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (!validIdRegex.test(projectId)) {
        throw new Error('Generated project ID is invalid');
      }

      return projectId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate project ID';
      onError?.(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, settings, onError, user]);

  return {
    generateProjectId,
    isLoading,
    isConfigured
  };
}