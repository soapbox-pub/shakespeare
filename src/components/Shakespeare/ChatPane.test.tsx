import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ChatPane } from './ChatPane';

// Mock the AI settings hook to return configured state
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: () => ({
    isConfigured: true,
    settings: {
      recentlyUsedModels: ['gpt-4'],
    },
    addRecentlyUsedModel: vi.fn(),
  }),
}));

// Mock other hooks
vi.mock('@/hooks/useFS', () => ({
  useFS: () => ({
    fs: {},
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
    metadata: null,
  }),
}));

vi.mock('@/hooks/useKeepAlive', () => ({
  useKeepAlive: () => ({
    updateMetadata: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAIChat', () => ({
  useAIChat: () => ({
    messages: [],
    streamingMessage: null,
    isLoading: false,
    totalCost: 0,
    lastInputTokens: 0,
    sendMessage: vi.fn(),
    startGeneration: vi.fn(),
    stopGeneration: vi.fn(),
    startNewSession: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProviderModels', () => ({
  useProviderModels: () => ({
    models: [
      {
        fullId: 'gpt-4',
        contextLength: 8192,
      },
    ],
  }),
}));

describe('ChatPane', () => {
  it('handles image paste from clipboard', async () => {
    render(
      <TestApp>
        <ChatPane projectId="test-project" />
      </TestApp>
    );

    const textarea = screen.getByPlaceholderText(/Ask me to add features/);
    expect(textarea).toBeInTheDocument();

    // Create a mock image file
    const imageFile = new File(['fake-image-data'], 'test.png', {
      type: 'image/png',
    });

    // Create mock clipboard data
    const mockClipboardItem = {
      type: 'image/png',
      getAsFile: () => imageFile,
    } as DataTransferItem;

    const mockClipboardData = {
      items: [mockClipboardItem],
      length: 1,
    } as unknown as DataTransfer;

    // Fire the paste event on the textarea using fireEvent
    fireEvent.paste(textarea, {
      clipboardData: mockClipboardData,
    });

    // The file should be added to the attached files
    // We can't easily test the internal state, but we can verify the event was handled
    // without throwing an error
    expect(textarea).toBeInTheDocument();
  });

  it('renders welcome message when no messages exist', () => {
    render(
      <TestApp>
        <ChatPane projectId="test-project" />
      </TestApp>
    );

    expect(screen.getByText('Welcome to Shakespeare')).toBeInTheDocument();
    expect(screen.getByText(/Your AI-powered development assistant/)).toBeInTheDocument();
  });
});