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

    // Group models by provider
    const modelsByProvider = new Map<string, ProviderModel[]>();
    for (const model of this.models) {
      const providerModels = modelsByProvider.get(model.provider) || [];
      providerModels.push(model);
      modelsByProvider.set(model.provider, providerModels);
    }

    // Build output
    let output = '# Available AI Models\n\n';

    // Add note about current image model if configured
    if (this.currentImageModel) {
      output += `**Current Image Model**: ${this.currentImageModel}\n\n`;
      output += 'This indicates the user\'s current preference. When selecting a new model, consider choosing a similar provider or model family unless the user requests otherwise.\n\n';
    } else {
      output += '**Current Image Model**: Not configured\n\n';
    }

    output += '## Models by Provider\n\n';

    for (const [provider, providerModels] of modelsByProvider) {
      output += `### ${provider}\n\n`;

      for (const model of providerModels) {
        const isCurrentModel = this.currentImageModel === model.fullId;
        const marker = isCurrentModel ? ' ⭐ **CURRENT**' : '';

        output += `- **${model.fullId}**${marker}\n`;

        if (model.name && model.name !== model.id) {
          output += `  - Name: ${model.name}\n`;
        }

        if (model.description) {
          output += `  - Description: ${model.description}\n`;
        }

        if (model.contextLength) {
          output += `  - Context Length: ${model.contextLength.toLocaleString()} tokens\n`;
        }

        if (model.modalities && model.modalities.length > 0) {
          output += `  - Modalities: ${model.modalities.join(', ')}\n`;
          
          // Highlight image generation capability
          if (model.modalities.includes('image')) {
            output += `  - ✅ **Supports image generation**\n`;
          }
        }

        output += '\n';
      }
    }

    output += '\n## Image Generation Recommendations\n\n';
    output += 'When selecting an image model:\n';
    output += '1. **Look for models with "image" in their modalities** - these support image generation\n';
    output += '2. **Consider cost and quality** - Models like gpt-image-1, dall-e-3, or similar are good balanced choices\n';
    output += '3. **Check the current model** (marked with ⭐) to understand user preferences\n';
    output += '4. **Prefer models from the same provider** as the current model when possible\n';

    return output;
  }
}
