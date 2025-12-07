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
        // Standard OpenAI image generation - use b64_json format
        const response = await client.images.generate({
          model: this.model,
          prompt,
          response_format: 'b64_json',
        });

        const b64Json = response.data?.[0]?.b64_json;
        if (!b64Json) {
          throw new Error('No base64 image data returned from the API');
        }

        // Decode base64 to bytes
        const binaryString = atob(b64Json);
        imageData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          imageData[i] = binaryString.charCodeAt(i);
        }

        // Extension is PNG for standard OpenAI responses
        extension = 'png';
      }

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
