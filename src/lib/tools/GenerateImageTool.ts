import { z } from 'zod';
import type { Tool } from './Tool';
import type { AIProvider } from '@/contexts/AISettingsContext';
import type { NUser } from '@nostrify/react/login';
import { createAIClient } from '@/lib/ai-client';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

interface GenerateImageParams {
  prompt: string;
}

export class GenerateImageTool implements Tool<GenerateImageParams> {
  readonly description = 'Generate an image from a text prompt and save it to the virtual filesystem';

  readonly inputSchema = z.object({
    prompt: z.string().describe('A detailed text description of the image to generate'),
  });

  constructor(
    private fs: JSRuntimeFS,
    private tmpPath: string,
    private provider: AIProvider,
    private imageModel: string,
    private user?: NUser,
    private corsProxy?: string,
  ) {}

  async execute(args: GenerateImageParams): Promise<string> {
    const { prompt } = args;

    try {
      const client = createAIClient(this.provider, this.user, this.corsProxy);

      let imageUrl: string | undefined;

      // OpenRouter uses chat completions with modalities
      if (this.provider.id === 'openrouter') {
        const response = await client.chat.completions.create({
          model: this.imageModel,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          modalities: ['image'] as never[], // Type assertion needed as OpenAI SDK doesn't have this typed
        });

        // Extract image URL from response
        const message = response.choices[0]?.message;
        if (message?.content) {
          const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }];
          const imageContent = content.find((part: { type: string; image_url?: { url: string } }) => part.type === 'image_url');
          if (imageContent && 'image_url' in imageContent) {
            imageUrl = imageContent.image_url?.url;
          }
        }
      } else {
        // Standard OpenAI image generation
        const response = await client.images.generate({
          model: this.imageModel,
          prompt,
          n: 1,
          response_format: 'url',
        });

        imageUrl = response.data?.[0]?.url;
      }

      if (!imageUrl) {
        throw new Error('No image URL returned from the API');
      }

      // Download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`);
      }

      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      const imageData = new Uint8Array(imageBuffer);

      // Determine file extension from content type
      const contentType = imageResponse.headers.get('content-type') || 'image/png';
      const extension = contentType.split('/')[1]?.split(';')[0] || 'png';

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `generated-${timestamp}.${extension}`;
      const filepath = `${this.tmpPath}/${filename}`;

      // Write image to VFS
      await this.fs.writeFile(filepath, imageData);

      return `Generated image: ${filepath}`;
    } catch (error) {
      throw new Error(
        `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
