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
  template: {
    name: string;
    description: string;
    url: string;
  };
}

interface ChatInfo {
  chatId: string;
}

type GeneratedInfo =
  | { type: 'project'; info: ProjectInfo }
  | { type: 'chat'; info: ChatInfo };

export function useGenerateProjectInfo({ onError }: UseGenerateProjectInfoOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const { settings, isConfigured } = useAISettings();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const projectsManager = useProjectsManager();

  // Helper function to generate incremented project name
  // Note: This assumes the baseId already exists (caller has verified this)
  const generateIncrementedId = useCallback(async (baseId: string, template: { url: string; name: string; description: string }, baseExists: boolean = true): Promise<ProjectInfo> => {
    // If base doesn't exist, just use it
    if (!baseExists) {
      const existingProject = await projectsManager.getProject(baseId);
      if (existingProject === null) {
        return {
          projectId: baseId,
          template,
        };
      }
    }

    // Start incrementing from -1
    let counter = 1;
    let fallbackId = `${baseId}-${counter}`;
    let existingProject = await projectsManager.getProject(fallbackId);

    // Keep incrementing until we find an available name
    while (existingProject !== null) {
      counter++;
      fallbackId = `${baseId}-${counter}`;
      existingProject = await projectsManager.getProject(fallbackId);
    }

    return {
      projectId: fallbackId,
      template,
    };
  }, [projectsManager]);

  const generateProjectInfo = useCallback(async (providerModel: string, prompt: string): Promise<GeneratedInfo> => {
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
      const startProjectTool: ChatCompletionTool = {
        type: 'function',
        function: {
          name: 'start_project',
          description: 'Start a new project by choosing a name and selecting the most appropriate template. Call this when the user wants to build an app or website.',
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

      // Create chat start tool
      const startChatTool: ChatCompletionTool = {
        type: 'function',
        function: {
          name: 'start_chat',
          description: 'Start a general conversation or chat session. Call this when the user wants to have a conversation, ask questions, or discuss ideas without building a specific app.',
          parameters: {
            type: 'object',
            properties: {
              chat_name: {
                type: 'string',
                description: 'A short, descriptive name for the chat. Should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens.',
              },
            },
            required: ['chat_name'],
          },
        },
      };

      const systemPrompt = `You are an AI assistant helping users either create projects or start conversations.

**First and foremost, you must decide whether to create a project or start a chat:**
- If the user expresses a desire to build, create, develop, or launch an app, website, or software product, they want to start a project.
- If the user wants to have a discussion, ask questions, brainstorm ideas, or seek advice without building a specific app, they want to start a chat.

1. If the user wants to **create a project** (build an app or website) - use start_project tool
   - Generate a short, unique, and memorable name for their product or brand
   - Name should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens
   - Select the most appropriate template from:
${config.templates.map(t => `     - ${t.name}: ${t.description} (${t.url})`).join('\n')}

2. If the user wants to **start a chat** (general conversation, questions, brainstorming) - use start_chat tool
   - Generate a short, descriptive name for the chat topic
   - Name should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens

You MUST call either start_project or start_chat based on the user's intent.`;

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      // Call AI with both tools
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools: [startProjectTool, startChatTool],
        tool_choice: "required",
        temperature: 1,
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];

      if (!toolCall || toolCall.type !== 'function') {
        throw new Error('AI failed to determine action');
      }

      const args = JSON.parse(toolCall.function.arguments);

      // Handle start_chat tool call
      if (toolCall.function.name === 'start_chat') {
        const chatId = args.chat_name as string;

        // Validate the generated chat ID
        const validIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        if (chatId && chatId.length <= 50 && validIdRegex.test(chatId)) {
          return {
            type: 'chat',
            info: { chatId },
          };
        }

        // Fallback to auto-generated chat ID if validation fails
        return {
          type: 'chat',
          info: { chatId: 'chat' },
        };
      }

      // Handle start_project tool call
      if (toolCall.function.name === 'start_project') {
        const templateUrl = args.template_url as string;
        const projectId = args.project_name as string;

        // Validate template URL
        const selectedTemplate = config.templates.find(t => t.url === templateUrl);
        if (!selectedTemplate) {
          // Fallback to first template if invalid URL selected
          console.warn(`Invalid template URL selected: ${templateUrl}, falling back to first template`);
          const fallbackInfo = await generateIncrementedId('untitled', config.templates[0], false);
          return {
            type: 'project',
            info: fallbackInfo,
          };
        }

        // Validate the generated project ID
        const validIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
        if (projectId && projectId.length <= 50 && validIdRegex.test(projectId)) {
          // Check if project exists
          const existingProject = await projectsManager.getProject(projectId);
          if (existingProject === null) {
            // Valid and unique project ID
            return {
              type: 'project',
              info: {
                projectId,
                template: selectedTemplate,
              },
            };
          }

          // Project already exists - increment the AI-generated ID (baseExists = true)
          const fallbackInfo = await generateIncrementedId(projectId, selectedTemplate, true);
          return {
            type: 'project',
            info: fallbackInfo,
          };
        }

        // If we reach here, the regex failed - fall back to "untitled" with number suffixes
        const fallbackInfo = await generateIncrementedId('untitled', selectedTemplate, false);
        return {
          type: 'project',
          info: fallbackInfo,
        };
      }

      // Unknown tool call
      throw new Error(`Unknown tool call: ${toolCall.function.name}`);
    } catch (error) {
      // On any error, fall back to first template with untitled name
      console.error('Error generating project info:', error);

      if (config.templates.length === 0) {
        const errorMessage = 'No templates configured';
        onError?.(errorMessage);
        throw new Error(errorMessage);
      }

      const fallbackInfo = await generateIncrementedId('untitled', config.templates[0], false);
      return {
        type: 'project',
        info: fallbackInfo,
      };
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, settings, onError, user, projectsManager, config.corsProxy, config.templates, generateIncrementedId]);

  return {
    generateProjectInfo,
    isLoading,
    isConfigured
  };
}
