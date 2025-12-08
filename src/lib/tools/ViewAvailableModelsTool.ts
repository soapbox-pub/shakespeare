import { z } from 'zod';
import type { Tool } from './Tool';

interface ProviderModel {
  id: string;
  name?: string;
  provider: string;
  fullId: string;
  description?: string;
  contextLength?: number;
  modalities?: string[];
}

export class ViewAvailableModelsTool implements Tool<Record<string, never>> {
  readonly description = 'View all available AI models across all configured providers, including their capabilities. This tool MUST be called before attempting to configure an image model, as it shows which models support image generation and displays the currently configured model (if any) to understand user preferences.';

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
    const filteredModels = this.models.filter(m => !m.modalities || m.modalities.includes('image'));

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
      output += `**Current Image Model**: ${this.currentImageModel} ⭐\n\n`;
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
        const isCurrentModel = this.currentImageModel === model.fullId;
        const marker = isCurrentModel ? ' ⭐' : '';
        output += `- ${model.fullId}${marker}\n`;
      }
      output += '\n';
    }

    if (this.currentImageModel) {
      output += `Current selection (⭐) indicates user preference for this provider/model family.\n`;
    }

    return output;
  }
}
