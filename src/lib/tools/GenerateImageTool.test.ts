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

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  it('should have correct description', () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'openai/dall-e-3',
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
      'openai/dall-e-3',
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
      'openai/dall-e-3',
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
      'openai/dall-e-3',
      undefined,
      undefined
    );

    // Mock the image generation API response
    const mockImageUrl = 'https://example.com/image.png';
    const mockImageData = new Uint8Array([1, 2, 3, 4]);

    mockOpenAI.images.generate.mockResolvedValue({
      data: [{ url: mockImageUrl }],
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      blob: async () => ({
        arrayBuffer: async () => mockImageData.buffer,
      }),
    } as Response);

    const result = await tool.execute({ prompt: 'a beautiful sunset' });

    expect(result).toMatch(/^Generated image: \/tmp\/generated-\d+\.png$/);
    expect(mockFS.writeFile).toHaveBeenCalled();
  });

  it('should handle OpenRouter provider with modalities', async () => {
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
      'openrouter/flux-1.1-pro',
      undefined,
      undefined
    );

    const mockImageUrl = 'https://example.com/image.png';
    const mockImageData = new Uint8Array([1, 2, 3, 4]);

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              {
                type: 'image_url',
                image_url: { url: mockImageUrl },
              },
            ],
          },
        },
      ],
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      blob: async () => ({
        arrayBuffer: async () => mockImageData.buffer,
      }),
    } as Response);

    const result = await tool.execute({ prompt: 'a beautiful sunset' });

    expect(result).toMatch(/^Generated image: \/tmp\/generated-\d+\.png$/);
    expect(mockFS.writeFile).toHaveBeenCalled();
  });

  it('should throw error when no image URL is returned', async () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'openai/dall-e-3',
      undefined,
      undefined
    );

    mockOpenAI.images.generate.mockResolvedValue({
      data: [],
    });

    await expect(tool.execute({ prompt: 'test' })).rejects.toThrow(
      'No image URL returned from the API'
    );
  });

  it('should throw error when image download fails', async () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'openai/dall-e-3',
      undefined,
      undefined
    );

    const mockImageUrl = 'https://example.com/image.png';

    mockOpenAI.images.generate.mockResolvedValue({
      data: [{ url: mockImageUrl }],
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    } as Response);

    await expect(tool.execute({ prompt: 'test' })).rejects.toThrow(
      'Failed to download image: Not Found'
    );
  });

  it('should determine file extension from content type', async () => {
    const tool = new GenerateImageTool(
      mockFS,
      '/tmp',
      mockProvider,
      'openai/dall-e-3',
      undefined,
      undefined
    );

    const mockImageUrl = 'https://example.com/image.jpg';
    const mockImageData = new Uint8Array([1, 2, 3, 4]);

    mockOpenAI.images.generate.mockResolvedValue({
      data: [{ url: mockImageUrl }],
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      blob: async () => ({
        arrayBuffer: async () => mockImageData.buffer,
      }),
    } as Response);

    const result = await tool.execute({ prompt: 'a beautiful sunset' });

    expect(result).toMatch(/^Generated image: \/tmp\/generated-\d+\.jpeg$/);
  });
});
