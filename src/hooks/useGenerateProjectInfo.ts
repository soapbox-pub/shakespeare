import { useState, useCallback } from 'react';
import { useAISettings } from '@/hooks/useAISettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useProjectsManager } from '@/hooks/useProjectsManager';
import { createAIClient } from '@/lib/ai-client';
import { parseProviderModel } from '@/lib/parseProviderModel';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

interface UseGenerateProjectInfoOptions {
  onError?: (error: string) => void;
}

interface ProjectInfo {
  projectId: string;
  templateUrl: string;
}

export function useGenerateProjectInfo({ onError }: UseGenerateProjectInfoOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const { settings, isConfigured } = useAISettings();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const projectsManager = useProjectsManager();

  // Helper function to generate untitled project name
  const fallbackWithUntitled = useCallback(async (templateUrl: string): Promise<ProjectInfo> => {
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

    return {
      projectId: fallbackId,
      templateUrl,
    };
  }, [projectsManager]);

  const generateProjectInfo = useCallback(async (providerModel: string, prompt: string): Promise<ProjectInfo> => {
    if (!isConfigured) {
      throw new Error('AI settings not configured');
    }

    if (!prompt.trim()) {
      throw new Error('Prompt cannot be empty');
    }

    if (config.templates.length === 0) {
      throw new Error('No templates configured');
    }

    setIsLoading(true);

    try {
      // Initialize OpenAI client
      const { model, provider } = parseProviderModel(providerModel, settings.providers);
      const openai = createAIClient(provider, user, config.corsProxy);

      // Create project creation tool
      const createProjectTool: ChatCompletionTool = {
        type: 'function',
        function: {
          name: 'create_project',
          description: 'Create a new project by choosing a name and selecting the most appropriate template. You must call this tool to create the project.',
          parameters: {
            type: 'object',
            properties: {
              project_name: {
                type: 'string',
                description: 'A short, unique, and memorable name for the project. Should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens.',
              },
              template_url: {
                type: 'string',
                description: `The Git URL of the selected template. Must be one of: ${config.templates.map(t => t.url).join(', ')}`,
                enum: config.templates.map(t => t.url),
              },
            },
            required: ['project_name', 'template_url'],
          },
        },
      };

      const systemPrompt = `You are a product expert helping users create new projects. Given the user's project description, you must:

1. Generate a short, unique, and memorable name for their product or brand. The name should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens. Avoid using special characters or underscores.

2. Select the most appropriate template from the available options:
${config.templates.map(t => `   - ${t.name}: ${t.description} (${t.url})`).join('\n')}

You MUST call the create_project tool with your choices.`;

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      // Call AI with tool
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools: [createProjectTool],
        tool_choice: { type: 'function', function: { name: 'create_project' } },
        temperature: 1,
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];

      if (!toolCall || toolCall.type !== 'function' || toolCall.function.name !== 'create_project') {
        throw new Error('AI failed to create the project');
      }

      const args = JSON.parse(toolCall.function.arguments);
      const templateUrl = args.template_url as string;
      const projectId = args.project_name as string;

      // Validate template URL
      const selectedTemplate = config.templates.find(t => t.url === templateUrl);
      if (!selectedTemplate) {
        // Fallback to first template if invalid URL selected
        console.warn(`Invalid template URL selected: ${templateUrl}, falling back to first template`);
        const fallbackTemplate = config.templates[0];
        return await fallbackWithUntitled(fallbackTemplate.url);
      }

      // Validate the generated project ID
      const validIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (projectId && projectId.length <= 50 && validIdRegex.test(projectId)) {
        // Check if project exists
        const existingProject = await projectsManager.getProject(projectId);
        if (existingProject === null) {
          // Valid and unique project ID
          return {
            projectId,
            templateUrl: selectedTemplate.url,
          };
        }
      }

      // If we reach here, either the regex failed or the project already exists
      // Fall back to "untitled" with number suffixes
      return await fallbackWithUntitled(selectedTemplate.url);
    } catch (error) {
      // On any error, fall back to first template with untitled name
      console.error('Error generating project info:', error);

      if (config.templates.length === 0) {
        const errorMessage = 'No templates configured';
        onError?.(errorMessage);
        throw new Error(errorMessage);
      }

      return await fallbackWithUntitled(config.templates[0].url);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, settings, onError, user, projectsManager, config.corsProxy, config.templates, fallbackWithUntitled]);

  return {
    generateProjectInfo,
    isLoading,
    isConfigured
  };
}
