import { z } from 'zod';
import type { Tool } from './Tool';
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
  readonly description = 'Configure the AI model to use for image generation. The modelId must be a complete model identifier in the format "provider/model" (e.g., "openrouter/openai/gpt-image-1", "openai/dall-e-3", or "shakespeare/gpt-image-1"). IMPORTANT: You MUST call the view_available_models tool FIRST to see which models are available and support image generation (look for models with "image" in their modalities). Select a high-quality yet affordable model like gpt-image-1 or dall-e-3 unless the user has specific requirements. Consider the currently configured model (if any) to understand user preferences.';

  readonly inputSchema = z.object({
    modelId: z.string().describe('The complete model identifier in "provider/model" format (e.g., "openrouter/openai/gpt-image-1", "openai/dall-e-3"). Must be from the available models list.'),
  });

  constructor(
    private aiSettings: AISettingsContextType,
    private models: ProviderModel[],
  ) {}

  async execute(args: ConfigureImageGenerationParams): Promise<string> {
    const { modelId } = args;

    // Validate model ID format
    if (!modelId.includes('/')) {
      return 'ERROR: Invalid model ID format. The modelId must be in "provider/model" format (e.g., "openrouter/openai/gpt-image-1" or "openai/dall-e-3").\n\n' +
        'Please call the view_available_models tool first to see the list of available models and their full IDs, then use one of those full IDs.';
    }

    // Check if model exists in available models
    const model = this.models.find(m => m.fullId === modelId);
    
    if (!model) {
      return `ERROR: Model "${modelId}" is not available in the configured providers.\n\n` +
        'Please call the view_available_models tool to see the list of available models, then select one from that list.';
    }

    // Check if model supports image generation
    const supportsImage = model.modalities?.includes('image');
    
    if (!supportsImage) {
      return `ERROR: Model "${modelId}" does not support image generation.\n\n` +
        'Please call the view_available_models tool and select a model that has "image" listed in its modalities (look for models marked with "✅ Supports image generation").';
    }

    // Update the settings
    this.aiSettings.updateSettings({ imageModel: modelId });

    let response = `✅ Successfully configured image generation!\n\n`;
    response += `**Image Model**: ${modelId}\n`;
    
    if (model.name) {
      response += `**Name**: ${model.name}\n`;
    }
    
    if (model.description) {
      response += `**Description**: ${model.description}\n`;
    }

    response += `\nThe generate_image tool is now available and ready to use. You can generate images by calling the generate_image tool with a detailed text prompt.`;

    return response;
  }
}
