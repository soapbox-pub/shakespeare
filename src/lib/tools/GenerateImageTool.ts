import { z } from 'zod';
import type { Tool, ToolResult } from './Tool';
import type { AIProvider } from '@/contexts/AISettingsContext';
import type { NUser } from '@nostrify/react/login';
import { createAIClient } from '@/lib/ai-client';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { proxyUrl } from '../proxyUrl';

interface GenerateImageParams {
  prompt: string;
  output_format?: "png" | "jpeg" | "webp";
  output_compression?: number;
  size?: "auto" | "1024x1024" | "1536x1024" | "1024x1536" | "256x256" | "512x512" | "1792x1024" | "1024x1792";
}

export type ImageGenerationMode = 'chat' | 'image';

export class GenerateImageTool implements Tool<GenerateImageParams> {
  readonly description = 'Generate an image from a text prompt and save it to the virtual filesystem';

  readonly inputSchema = z.object({
    prompt: z.string().describe('A detailed text description of the image to generate'),
    output_format: z.enum(["png", "jpeg", "webp"]).optional().describe('Output format for the image (e.g., "png", "jpeg", "webp"). Support varies by model - leave blank if unsure'),
    output_compression: z.number().min(1).max(100).optional().describe('Compression quality for the image (0 to 100). Only applicable for "jpeg" and "webp" formats'),
    size: z.enum(["auto", "1024x1024", "1536x1024", "1024x1536", "256x256", "512x512", "1792x1024", "1024x1792"]).optional().describe('Size of the generated image (e.g., "1024x1024", "1536x1024"). Support varies by model - leave blank if unsure'),
  });

  constructor(
    private fs: JSRuntimeFS,
    private tmpPath: string,
    private provider: AIProvider,
    private model: string,
    private mode: ImageGenerationMode,
    private user?: NUser,
    private corsProxy?: string,
  ) {}

  async execute(args: GenerateImageParams): Promise<ToolResult> {
    const { prompt, output_format, output_compression, size } = args;

    try {
      const client = createAIClient(this.provider, this.user, this.corsProxy);

      let cost: number | undefined;
      let imageData: Uint8Array;
      let extension = output_format ?? 'png';

      // Use chat completions endpoint for models that support image output modality
      if (this.mode === 'chat') {
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

        // Extract cost from response
        const { usage } = response;
        if (usage && 'cost' in usage && typeof usage.cost === 'number') {
          cost = usage.cost;
        }

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

        if (dataUriMatch[1] === "png" || dataUriMatch[1] === "jpeg" || dataUriMatch[1] === "webp") {
          extension = dataUriMatch[1];
        }

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
          output_format,
          output_compression,
          size,
        });

        // Extract cost from response
        const { usage } = response;
        if (usage && 'cost' in usage && typeof usage.cost === 'number') {
          cost = usage.cost;
        }

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
            if (match && (match[1] === 'png' || match[1] === 'jpeg' || match[1] === 'webp')) {
              extension = match[1];
            }
          }
        } else {
          throw new Error('No base64 image data or URL returned from the API');
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

      return { content: `Generated image: ${filepath}`, cost };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate image: ${errorMessage}`);
    }
  }
}
