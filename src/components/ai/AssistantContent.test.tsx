import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantContent } from './AssistantContent';
import { TestApp } from '@/test/TestApp';
import type { CoreToolMessage } from 'ai';


describe('AssistantContent', () => {
  const mockToolResults: CoreToolMessage[] = [];

  describe('Build Action Detection', () => {
    it('should render build action for auto-build success message', () => {
      const content = '✅ Agent completed successfully. Project built and preview updated!';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      // Check if BuildAction component is rendered with auto-build title
      expect(screen.getByText('Auto-Build Project')).toBeInTheDocument();
    });

    it('should render regular markdown for non-build-action string content', () => {
      const content = 'Hello, I can help you with your project.';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Hello, I can help you with your project.')).toBeInTheDocument();
      expect(screen.queryByText(/Project|Action/)).not.toBeInTheDocument();
    });

    it('should render tool calls for array content with tool-call items', () => {
      const content = [
        { type: 'tool-call' as const, toolName: 'some_custom_tool', toolCallId: 'test-id', args: { param1: 'value1' } }
      ];

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText(/some_custom_tool/)).toBeInTheDocument();
    });
  });
});