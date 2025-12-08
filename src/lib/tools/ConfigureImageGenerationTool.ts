import { z } from 'zod';
import type { Tool, ToolResult } from './Tool';
import type { AISettingsContextType } from '@/contexts/AISettingsContext';

interface ConfigureImageGenerationParams {
  modelId: string;
}

interface ProviderModel {
  id: string;
  name?: string;
  provider: string;
  fullId: string;
  description?: string;
  contextLength?: number;
  modalities?: string[];
}

export class ConfigureImageGenerationTool implements Tool<ConfigureImageGenerationParams> {
  readonly description = 'Configure the AI model to use for image generation. The modelId must be a complete model identifier in the format "provider/model" (e.g., "openrouter/openai/gpt-image-1", "openai/dall-e-3", or "shakespeare/gpt-image-1"). You can optionally call view_available_models first to see available image models, but any valid model ID from a configured provider will work. Prefer gpt-image-1 as the first choice, followed by gemini-3-pro-image, unless the user has specific requirements.';

  readonly inputSchema = z.object({
    modelId: z.string().describe('The complete model identifier in "provider/model" format (e.g., "openrouter/openai/gpt-image-1", "openai/dall-e-3").'),
  });

  constructor(
    private aiSettings: AISettingsContextType,
    private models: ProviderModel[],
  ) {}

  async execute(args: ConfigureImageGenerationParams): Promise<ToolResult> {
    const { modelId } = args;

    // Validate model ID format
    if (!modelId.includes('/')) {
      return { content: 'ERROR: Invalid model ID format. The modelId must be in "provider/model" format (e.g., "openrouter/openai/gpt-image-1" or "openai/dall-e-3").' };
    }

    // Check if model exists in available models (optional - provides helpful info if available)
    const model = this.models.find(m => m.fullId === modelId);

    // Update the settings
    this.aiSettings.updateSettings({ imageModel: modelId });

    let response = `✅ Successfully configured image generation!\n\n`;
    response += `**Image Model**: ${modelId}\n`;

    if (model?.name) {
      response += `**Name**: ${model.name}\n`;
    }

    if (model?.description) {
      response += `**Description**: ${model.description}\n`;
    }

    response += `\nThe generate_image tool is now available and ready to use. You can generate images by calling the generate_image tool with a detailed text prompt.`;

    return { content: response };
  }
}
