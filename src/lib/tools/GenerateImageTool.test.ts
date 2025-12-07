import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateImageTool } from './GenerateImageTool';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { AIProvider } from '@/contexts/AISettingsContext';

// Mock the createAIClient function
vi.mock('@/lib/ai-client', () => ({
  createAIClient: vi.fn(),
}));

import { createAIClient } from '@/lib/ai-client';

describe('GenerateImageTool', () => {
  let mockFS: JSRuntimeFS;
  let mockProvider: AIProvider;
  let mockOpenAI: {
    images: { generate: ReturnType<typeof vi.fn> };
    chat: { completions: { create: ReturnType<typeof vi.fn> } };
  };

  beforeEach(() => {
    mockFS = {
      writeFile: vi.fn(),
    } as unknown as JSRuntimeFS;

    mockProvider = {
      id: 'openai',
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    };

    // Create mock OpenAI client
    mockOpenAI = {
      images: {
        generate: vi.fn(),
      },
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    // Mock createAIClient to return our mock
    (createAIClient as ReturnType<typeof vi.fn>).mockReturnValue(mockOpenAI);
  });

  it('should have correct description', () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'dall-e-3',
      undefined,
      undefined,
      undefined
    );

    expect(tool.description).toBe(
      'Generate an image from a text prompt and save it to the virtual filesystem'
    );
  });

  it('should validate prompt parameter', () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'dall-e-3',
      undefined,
      undefined,
      undefined
    );

    const result = tool.inputSchema.safeParse({ prompt: 'a beautiful sunset' });
    expect(result.success).toBe(true);
  });

  it('should reject missing prompt', () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'dall-e-3',
      undefined,
      undefined,
      undefined
    );

    const result = tool.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should generate image with standard OpenAI provider', async () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'dall-e-3',
      undefined,
      undefined,
      undefined
    );

    // Mock the image generation API response with b64_json
    const mockImageData = new Uint8Array([1, 2, 3, 4]);
    const base64Data = btoa(String.fromCharCode(...mockImageData));

    mockOpenAI.images.generate.mockResolvedValue({
      data: [{ b64_json: base64Data }],
    });

    const result = await tool.execute({ prompt: 'a beautiful sunset' });

    expect(result).toMatch(/^Generated image: \/tmp\/generated-\d+\.png$/);
    expect(mockFS.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/generated-\d+\.png$/),
      expect.any(Uint8Array)
    );
  });

  it('should handle models with image output modality', async () => {
    const openRouterProvider: AIProvider = {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
    };

    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      openRouterProvider,
      'flux-1.1-pro',
      ['image'], // Model supports image output modality
      undefined,
      undefined
    );

    // Create a data URI with base64 encoded image data
    const mockImageData = new Uint8Array([1, 2, 3, 4]);
    const base64Data = btoa(String.fromCharCode(...mockImageData));
    const dataUri = `data:image/png;base64,${base64Data}`;

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            images: [
              {
                type: 'image_url',
                image_url: { url: dataUri },
              },
            ],
          },
        },
      ],
    });

    const result = await tool.execute({ prompt: 'a beautiful sunset' });

    expect(result).toMatch(/^Generated image: \/tmp\/generated-\d+\.png$/);
    expect(mockFS.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/generated-\d+\.png$/),
      expect.any(Uint8Array)
    );
  });

  it('should throw error when no image data is returned', async () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'dall-e-3',
      undefined,
      undefined,
      undefined
    );

    mockOpenAI.images.generate.mockResolvedValue({
      data: [],
    });

    await expect(tool.execute({ prompt: 'test' })).rejects.toThrow(
      'No base64 image data returned from the API'
    );
  });

  it('should throw error when model with image modality returns invalid response', async () => {
    const openRouterProvider: AIProvider = {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
    };

    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      openRouterProvider,
      'flux-1.1-pro',
      ['image'], // Model supports image output modality
      undefined,
      undefined
    );

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Invalid response',
          },
        },
      ],
    });

    await expect(tool.execute({ prompt: 'test' })).rejects.toThrow(
      'Failed to generate image: Invalid response format from the API'
    );
  });

  it('should determine file extension from data URI for models with image modality', async () => {
    const openRouterProvider: AIProvider = {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
    };

    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      openRouterProvider,
      'flux-1.1-pro',
      ['image'], // Model supports image output modality
      undefined,
      undefined
    );

    // Create a data URI with JPEG format
    const mockImageData = new Uint8Array([1, 2, 3, 4]);
    const base64Data = btoa(String.fromCharCode(...mockImageData));
    const dataUri = `data:image/jpeg;base64,${base64Data}`;

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            images: [
              {
                type: 'image_url',
                image_url: { url: dataUri },
              },
            ],
          },
        },
      ],
    });

    const result = await tool.execute({ prompt: 'a beautiful sunset' });

    expect(result).toMatch(/^Generated image: \/tmp\/generated-\d+\.jpeg$/);
  });

  it('should throw error when model with image modality returns invalid data URI', async () => {
    const openRouterProvider: AIProvider = {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
    };

    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      openRouterProvider,
      'flux-1.1-pro',
      ['image'], // Model supports image output modality
      undefined,
      undefined
    );

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            images: [
              {
                type: 'image_url',
                image_url: { url: 'https://example.com/image.png' },
              },
            ],
          },
        },
      ],
    });

    await expect(tool.execute({ prompt: 'test' })).rejects.toThrow(
      'Invalid data URI format'
    );
  });
});
