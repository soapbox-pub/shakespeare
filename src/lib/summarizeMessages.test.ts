import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeMessages } from './summarizeMessages';
import type { AIMessage } from './SessionManager';
import type { AIProvider } from '@/contexts/AISettingsContext';

// Mock the ai-client module
vi.mock('./ai-client', () => ({
  createAIClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [
            {
              message: {
                content: 'This is a test summary of the conversation.'
              }
            }
          ]
        }))
      }
    }
  }))
}));

describe('summarizeMessages', () => {
  const mockProviders: AIProvider[] = [
    {
      id: 'test-provider',
      baseURL: 'https://api.test.com',
      apiKey: 'test-key'
    }
  ];

  const mockAISettings = { providers: mockProviders };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should summarize a conversation with user and assistant messages', async () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'Hello, can you help me build a todo app?' },
      { role: 'assistant', content: 'Sure! I can help you build a todo app.' },
      { role: 'user', content: 'Please add a feature to mark tasks as complete' },
      { role: 'assistant', content: 'I will add that feature now.', tool_calls: [] }
    ];

    const summary = await summarizeMessages(
      messages,
      'test-provider/test-model',
      mockAISettings
    );

    expect(summary).toBe('This is a test summary of the conversation.');
  });

  it('should handle messages with tool calls', async () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'Add a button' },
      {
        role: 'assistant',
        content: 'I will add a button',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: { name: 'text_editor_write', arguments: '{}' }
          }
        ]
      }
    ];

    const summary = await summarizeMessages(
      messages,
      'test-provider/test-model',
      mockAISettings
    );

    expect(summary).toBe('This is a test summary of the conversation.');
  });

  it('should handle array content in user messages', async () => {
    const messages: AIMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is my request' },
          { type: 'text', text: 'Added file: /tmp/image.png' }
        ]
      },
      { role: 'assistant', content: 'I understand your request' }
    ];

    const summary = await summarizeMessages(
      messages,
      'test-provider/test-model',
      mockAISettings
    );

    expect(summary).toBe('This is a test summary of the conversation.');
  });

  it('should handle tool messages', async () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'Create a file' },
      {
        role: 'assistant',
        content: 'Creating file',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: { name: 'text_editor_write', arguments: '{}' }
          }
        ]
      },
      {
        role: 'tool',
        content: 'File created successfully at /projects/test/index.html',
        tool_call_id: 'call_123'
      }
    ];

    const summary = await summarizeMessages(
      messages,
      'test-provider/test-model',
      mockAISettings
    );

    expect(summary).toBe('This is a test summary of the conversation.');
  });

  it('should throw error if summary generation fails', async () => {
    const { createAIClient } = await import('./ai-client');

    // Mock to return empty content
    vi.mocked(createAIClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{ message: { content: '' } }]
          }))
        }
      }
    } as unknown as ReturnType<typeof createAIClient>);

    const messages: AIMessage[] = [
      { role: 'user', content: 'Test' },
      { role: 'assistant', content: 'Response' }
    ];

    await expect(
      summarizeMessages(messages, 'test-provider/test-model', mockAISettings)
    ).rejects.toThrow('Failed to generate summary');
  });
});
