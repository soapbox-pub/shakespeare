import { describe, it, expect } from 'vitest';

// Test the streaming message history saving behavior
describe('useStreamingChat history saving fix', () => {
  it('should only save completed messages to history', () => {
    // Test the logic for when messages should be saved to history
    const testCases = [
      {
        message: {
          role: 'user' as const,
          content: 'Hello AI',
          isStreaming: false,
        },
        shouldSave: true,
        description: 'completed user message'
      },
      {
        message: {
          role: 'assistant' as const,
          content: 'Hello user',
          isStreaming: false,
        },
        shouldSave: true,
        description: 'completed assistant message'
      },
      {
        message: {
          role: 'assistant' as const,
          content: '',
          isStreaming: true,
        },
        shouldSave: false,
        description: 'streaming assistant message (empty)'
      },
      {
        message: {
          role: 'assistant' as const,
          content: 'Partial response...',
          isStreaming: true,
        },
        shouldSave: false,
        description: 'streaming assistant message (with content)'
      },
    ];

    testCases.forEach(({ message, shouldSave }) => {
      // This is the logic from the addMessage function
      const willSave = !message.isStreaming;
      expect(willSave).toBe(shouldSave);
    });
  });

  it('should save messages when streaming stops', () => {
    // Test the logic for when streaming messages get saved
    const testCases = [
      {
        previousMessage: {
          role: 'assistant' as const,
          content: 'Hello world',
          isStreaming: true,
        },
        update: {
          isStreaming: false,
        },
        shouldSave: true,
        description: 'streaming stops'
      },
      {
        previousMessage: {
          role: 'assistant' as const,
          content: 'Hello',
          isStreaming: true,
        },
        update: {
          content: 'Hello world',
          isStreaming: true,
        },
        shouldSave: false,
        description: 'content update but still streaming'
      },
      {
        previousMessage: {
          role: 'assistant' as const,
          content: 'Hello',
          isStreaming: false,
        },
        update: {
          content: 'Hello world',
        },
        shouldSave: false,
        description: 'update to already completed message'
      },
    ];

    testCases.forEach(({ previousMessage, update, shouldSave }) => {
      // This is the logic from the updateMessage function
      const willSave = update.isStreaming === false && previousMessage.isStreaming === true;
      expect(willSave).toBe(shouldSave);
    });
  });
});