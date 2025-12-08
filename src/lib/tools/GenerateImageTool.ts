import { z } from 'zod';
import type { Tool } from './Tool';
import type { AIProvider } from '@/contexts/AISettingsContext';
import type { NUser } from '@nostrify/react/login';
import { createAIClient } from '@/lib/ai-client';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { proxyUrl } from '../proxyUrl';
import { ImageGenerationError } from '@/lib/errors/ImageGenerationError';

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
    private model: string,
    private modalities: string[] | undefined,
    private user?: NUser,
    private corsProxy?: string,
  ) {}

  async execute(args: GenerateImageParams): Promise<string> {
    const { prompt } = args;

    try {
      const client = createAIClient(this.provider, this.user, this.corsProxy);

      let imageData: Uint8Array;
      let extension = 'png';

      // Check if the model supports image output modality (chat completions path)
      const supportsImageOutput = this.modalities?.includes('image');

      if (supportsImageOutput) {
        const response = await client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          modalities: ['image'] as never[], // Type assertion needed as OpenAI SDK doesn't have this typed
        });

        // Extract image data URI from response
        const message = response.choices[0]?.message;
        if (!message) {
          throw new Error('No message returned from the API');
        }

        const result = z.object({
          images: z.object({
            type: z.literal('image_url'),
            image_url: z.object({
              url: z.string(),
            }),
          }).array().min(1),
        }).safeParse(message);

        if (!result.success) {
          throw new Error('Invalid response format from the API');
        }

        const dataUri = result.data.images[0].image_url.url;

        // Parse data URI: data:image/png;base64,iVBORw0KGgoAAAANS...
        const dataUriMatch = dataUri.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (!dataUriMatch) {
          throw new Error('Invalid data URI format');
        }

        extension = dataUriMatch[1];
        const base64Data = dataUriMatch[2];

        // Decode base64 to bytes
        const binaryString = atob(base64Data);
        imageData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          imageData[i] = binaryString.charCodeAt(i);
        }
      } else {
        // Standard OpenAI image generation
        const response = await client.images.generate({
          model: this.model,
          prompt,
        });

        const firstImage = response.data?.[0];
        if (!firstImage) {
          throw new Error('No image data returned from the API');
        }

        // Check if we got b64_json or url
        if (firstImage.b64_json) {
          // Decode base64 to bytes
          const binaryString = atob(firstImage.b64_json);
          imageData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            imageData[i] = binaryString.charCodeAt(i);
          }
        } else if (firstImage.url) {
          // Fetch the image from the URL
          const imageUrl = this.corsProxy ? proxyUrl(this.corsProxy, firstImage.url) : firstImage.url;
          const imageResponse = await fetch(imageUrl);

          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from URL: ${imageResponse.status} ${imageResponse.statusText}`);
          }

          const arrayBuffer = await imageResponse.arrayBuffer();
          imageData = new Uint8Array(arrayBuffer);

          // Try to determine extension from content-type header
          const contentType = imageResponse.headers.get('content-type');
          if (contentType) {
            const match = contentType.match(/image\/([^;]+)/);
            if (match) {
              extension = match[1];
            }
          }
        } else {
          throw new Error('No base64 image data or URL returned from the API');
        }

        // Default extension is PNG for standard OpenAI responses
        if (extension === 'png') {
          extension = 'png';
        }
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `generated-${timestamp}.${extension}`;
      const filepath = `${this.tmpPath}/${filename}`;

      // Ensure tmp directory exists
      try {
        await this.fs.stat(this.tmpPath);
      } catch {
        await this.fs.mkdir(this.tmpPath, { recursive: true });
      }

      // Write image to VFS
      await this.fs.writeFile(filepath, imageData);

      return `Generated image: ${filepath}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ImageGenerationError(
        `Failed to generate image: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}
