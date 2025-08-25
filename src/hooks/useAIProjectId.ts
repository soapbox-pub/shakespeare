import { useState, useCallback } from 'react';
import OpenAI from 'openai';
import { useAISettings } from '@/hooks/useAISettings';

interface UseAIProjectIdOptions {
  onError?: (error: string) => void;
}

export function useAIProjectId({ onError }: UseAIProjectIdOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const { settings, isConfigured } = useAISettings();

  const generateProjectId = useCallback(async (prompt: string): Promise<string> => {
    if (!isConfigured) {
      throw new Error('AI settings not configured');
    }

    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    setIsLoading(true);

    try {
      // Use first available provider as fallback
      const providers = settings.providers || {};
      const firstProvider = Object.keys(providers)[0];
      if (!firstProvider || !providers[firstProvider]?.apiKey) {
        throw new Error('No configured AI providers available');
      }

      const connectionConfig = providers[firstProvider];
      const modelName = 'gpt-3.5-turbo'; // Use a fast, cheap model for ID generation

      // Initialize OpenAI client
      const openai = new OpenAI({
        baseURL: connectionConfig.baseURL,
        apiKey: connectionConfig.apiKey,
        dangerouslyAllowBrowser: true
      });

      const systemPrompt = `You are a project ID generator. Given a user's description of what they want to build, generate a short, descriptive, kebab-case project ID that captures the essence of their project.

Rules:
- Use only lowercase letters, numbers, and hyphens
- Keep it between 2-4 words
- Make it descriptive but concise
- No spaces, underscores, or special characters except hyphens
- Examples:
  - "farming equipment marketplace" → "farming-marketplace"
  - "social media for artists" → "artist-social-app"
  - "crypto trading dashboard" → "crypto-dashboard"
  - "recipe sharing platform" → "recipe-platform"

Respond with ONLY the project ID, no explanation or additional text.`;

      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 20,
        temperature: 0.3,
      });

      const projectId = completion.choices[0]?.message?.content?.trim();

      if (!projectId) {
        throw new Error('Failed to generate project ID');
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
  }, [isConfigured, settings, onError]);

  return {
    generateProjectId,
    isLoading,
    isConfigured
  };
}