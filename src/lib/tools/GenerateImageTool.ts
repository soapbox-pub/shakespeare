import { z } from 'zod';
import type OpenAI from 'openai';
import type { Tool, ToolResult } from './Tool';
import type { AIProvider } from '@/contexts/AISettingsContext';
import type { NUser } from '@nostrify/react/login';
import { createAIClient } from '@/lib/ai-client';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { fileToUrl } from '@/lib/imageUtils';
import { proxyUrl } from '../proxyUrl';

interface GenerateImageParams {
  prompt: string;
  output_format?: "png" | "jpeg" | "webp";
  output_compression?: number;
  size?: "auto" | "1024x1024" | "1536x1024" | "1024x1536" | "256x256" | "512x512" | "1792x1024" | "1024x1792";
  background?: "transparent" | "opaque" | "auto";
}

export type ImageGenerationMode = 'chat' | 'image';

/** Images to start from when editing instead of generating. */
export interface SourceImages {
  images: File[];
  /** PNG whose transparent areas mark the region of the first image to change. */
  mask?: File;
}

export class GenerateImageTool implements Tool<GenerateImageParams> {
  readonly description = 'Generate an image from a text prompt and save it to the virtual filesystem';

  readonly inputSchema = z.object({
    prompt: z.string().describe('A detailed text description of the image to generate'),
    output_format: z.enum(["png", "jpeg", "webp"]).optional().describe('Output format for the image (e.g., "png", "jpeg", "webp"). Support varies by model - leave blank if unsure'),
    output_compression: z.number().min(1).max(100).optional().describe('Compression quality for the image (0 to 100). Only applicable for "jpeg" and "webp" formats'),
    size: z.enum(["auto", "1024x1024", "1536x1024", "1024x1536", "256x256", "512x512", "1792x1024", "1024x1792"]).optional().describe('Size of the generated image (e.g., "1024x1024", "1536x1024"). Support varies by model - leave blank if unsure'),
    background: z.enum(["transparent", "opaque", "auto"]).optional().describe('Background setting for the generated image. Use "transparent" for images that need transparency (e.g., logos, icons, overlays). Only supported with "png" or "webp" output formats'),
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
    try {
      const { path, dataUri, cost } = await this.render(args, 'generated');
      return { content: `Generated image: ${path}`, images: [dataUri], cost };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate image: ${errorMessage}`);
    }
  }

  /**
   * Generate an image (or edit `source`) and write it to the tmp directory.
   * Returns the file path and the image as a data URI.
   */
  async render(
    args: GenerateImageParams,
    prefix: string,
    source?: SourceImages,
  ): Promise<{ path: string; dataUri: string; cost?: number }> {
    const { prompt, output_format, output_compression, size, background } = args;
    const client = createAIClient(this.provider, this.user, this.corsProxy);

    let cost: number | undefined;
    let imageData: Uint8Array;
    let extension = output_format ?? 'png';

    // Use chat completions endpoint for models that support image output modality
    if (this.mode === 'chat') {
      let content: OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'] = prompt;
      if (source) {
        const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: 'text', text: prompt }];
        for (const image of source.images) {
          parts.push({ type: 'image_url', image_url: { url: await fileToUrl(image) } });
        }
        if (source.mask) {
          parts.push(
            { type: 'text', text: 'The next image is a mask for the first image. Change only the areas that are transparent in the mask, and keep everything else exactly as it is.' },
            { type: 'image_url', image_url: { url: await fileToUrl(source.mask) } },
          );
        }
        content = parts;
      }

      const response = await client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content }],
        modalities: ['image'] as never[], // Type assertion needed as OpenAI SDK doesn't have this typed
      });

      // Default extension for chat models is png (output_format is ignored)
      extension = 'png';

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

      imageData = base64ToBytes(dataUriMatch[2]);
    } else {
      // Standard OpenAI image generation, or editing when there are source images
      let response: OpenAI.Images.ImagesResponse;
      if (source) {
        response = await client.images.edit({
          model: this.model,
          prompt,
          image: source.images.length === 1 ? source.images[0] : source.images,
          mask: source.mask,
          output_format,
          output_compression,
          size: size as OpenAI.Images.ImageEditParams['size'],
          background,
        });
      } else {
        response = await client.images.generate({
          model: this.model,
          prompt,
          output_format,
          output_compression,
          size,
          background,
        });
      }

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
        imageData = base64ToBytes(firstImage.b64_json);
      } else if (firstImage.url) {
        // Fetch the image from the URL
        const imageUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url: firstImage.url }) : firstImage.url;
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
    const filename = `${prefix}-${timestamp}.${extension}`;
    const filepath = `${this.tmpPath}/${filename}`;

    // Ensure tmp directory exists
    try {
      await this.fs.stat(this.tmpPath);
    } catch {
      await this.fs.mkdir(this.tmpPath, { recursive: true });
    }

    // Write image to VFS
    await this.fs.writeFile(filepath, imageData);

    const dataUri = await fileToUrl(new File([imageData], filename, { type: `image/${extension}` }));

    return { path: filepath, dataUri, cost };
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
