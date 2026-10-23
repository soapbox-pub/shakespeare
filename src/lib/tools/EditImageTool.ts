import { z } from 'zod';
import { join } from 'path-browserify';

import type { Tool, ToolResult } from './Tool';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { GenerateImageTool } from './GenerateImageTool';

interface EditImageParams {
  prompt: string;
  image_paths: string[];
  mask_path?: string;
  output_format?: "png" | "jpeg" | "webp";
  size?: "auto" | "1024x1024" | "1536x1024" | "1024x1536";
  background?: "transparent" | "opaque" | "auto";
}

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export class EditImageTool implements Tool<EditImageParams> {
  readonly description = `Edit existing images with the image model and save the result to the virtual filesystem. The result is shown to you.

Use this to change artwork: adding, removing, or restyling something in an illustration, logo, icon, or photo. The model redraws the image with the change built in, matching its style, line work, shading, and perspective. This works far better than drawing on top of an image with code, which looks pasted on.

- image_paths: the image to edit first, then any references (for example a style reference, or an object to add).
- prompt: describe the change and what must stay the same, e.g. "Add a small gold star to the front of the hat, drawn in the same ink style. Keep everything else unchanged."
- mask_path: optional PNG the same size as the first image; its transparent pixels mark the only area that may change.

The output may differ in size from the input. Resize or crop it with code afterwards if the project needs exact dimensions.`;

  readonly inputSchema = z.object({
    prompt: z.string().describe('The change to make, and what to keep the same'),
    image_paths: z.array(z.string()).min(1).max(16).describe('Paths of the images to edit (PNG, JPEG, or WebP). The first is the one being edited; others are references'),
    mask_path: z.string().optional().describe('Optional PNG mask for the first image; transparent areas are the region to edit'),
    output_format: z.enum(["png", "jpeg", "webp"]).optional().describe('Output format. Support varies by model - leave blank if unsure'),
    size: z.enum(["auto", "1024x1024", "1536x1024", "1024x1536"]).optional().describe('Output size. Support varies by model - leave blank if unsure'),
    background: z.enum(["transparent", "opaque", "auto"]).optional().describe('Use "transparent" to keep a transparent background. Only supported with "png" or "webp" output'),
  });

  constructor(
    private fs: JSRuntimeFS,
    private cwd: string,
    private generator: GenerateImageTool,
  ) {}

  async execute(args: EditImageParams): Promise<ToolResult> {
    const { prompt, image_paths, mask_path, output_format, size, background } = args;

    const images = await Promise.all(image_paths.map((path) => this.readImage(path)));
    const mask = mask_path ? await this.readImage(mask_path) : undefined;

    try {
      const { path, dataUri, cost } = await this.generator.render(
        { prompt, output_format, size, background },
        'edited',
        { images, mask },
      );
      return { content: `Edited image: ${path}`, images: [dataUri], cost };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to edit image: ${errorMessage}`);
    }
  }

  private async readImage(path: string): Promise<File> {
    const filepath = path.startsWith('/') ? path : join(this.cwd, path);
    const ext = filepath.split('.').pop()?.toLowerCase() ?? '';
    const type = MIME_TYPES[ext];
    if (!type) {
      throw new Error(`Unsupported image type: ${path}. Use PNG, JPEG, or WebP (convert other formats first).`);
    }

    let bytes: Uint8Array;
    try {
      bytes = await this.fs.readFile(filepath);
    } catch {
      throw new Error(`File not found: ${filepath}`);
    }

    return new File([bytes], filepath.split('/').pop() || 'image', { type });
  }
}
