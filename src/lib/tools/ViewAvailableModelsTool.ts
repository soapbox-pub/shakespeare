import { z } from 'zod';
import type { Tool } from './Tool';

interface ProviderModel {
  id: string;
  type?: 'chat' | 'image';
  name?: string;
  provider: string;
  fullId: string;
  description?: string;
  contextLength?: number;
  modalities?: string[];
}

export class ViewAvailableModelsTool implements Tool<Record<string, never>> {
  readonly description = 'View all available AI models across all configured providers, including their capabilities. This tool MUST be called before attempting to configure an image model, as it shows which models support image generation.';

  readonly inputSchema = z.object({});

  constructor(
    private models: ProviderModel[],
    private currentImageModel?: string,
  ) {}

  async execute(): Promise<string> {
    if (this.models.length === 0) {
      return 'No AI models are currently available. Please configure at least one AI provider in Settings > AI.';
    }

    // Filter image-capable models
    // Filter out models that are definitely NOT image models
    const filteredModels = this.models.filter((model) => {
      // If type is "chat", exclude it
      if (model.type === 'chat') {
        return false;
      }
      // If modalities exist but don't include "image", exclude it
      if (model.modalities && !model.modalities.includes('image')) {
        return false;
      }
      // Otherwise include it (type is "image", modalities includes "image", or both are undefined)
      return true;
    });

    // Group models by provider
    const modelsByProvider = new Map<string, ProviderModel[]>();
    for (const model of filteredModels) {
      const providerModels = modelsByProvider.get(model.provider) || [];
      providerModels.push(model);
      modelsByProvider.set(model.provider, providerModels);
    }

    // Build output
    let output = '# Available Models\n\n';

    // Add note about current image model if configured
    if (this.currentImageModel) {
      output += `**Current Image Model**: ${this.currentImageModel}\n\n`;
    } else {
      output += '**Current Image Model**: Not configured\n\n';
    }

    if (filteredModels.length === 0) {
      output += 'No models found in configured providers.\n';
      output += `Total models available: ${this.models.length} (none support image generation)\n`;
      return output;
    }

    output += `Found ${filteredModels.length} models:\n\n`;

    for (const [provider, providerModels] of modelsByProvider) {
      output += `### ${provider} (${providerModels.length} models)\n\n`;

      for (const model of providerModels) {
        // Mark models that are DEFINITE image models with a star
        const isImageModel = model.type === 'image' || model.modalities?.includes('image');
        const marker = isImageModel ? ' ⭐' : '';
        output += `- ${model.fullId}${marker}\n`;
      }
      output += '\n';
    }

    output += `Models marked with ⭐ are definite image generation models.\n`;

    return output;
  }
}
