import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantContent } from './AssistantContent';
import { TestApp } from '@/test/TestApp';
import type { CoreToolMessage } from 'ai';

describe('AssistantContent', () => {
  const mockToolResults: CoreToolMessage[] = [];

  describe('Build Action Detection', () => {
    it('should render build action for string content with auto-build message', () => {
      const content = '✅ Agent completed successfully. Project built and preview updated!';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Auto-Build Project')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render build action for string content with build success message', () => {
      const content = '✅ Agent completed successfully. Project built! Switch to the "Preview" tab to see your changes.';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText(/Build Project|Auto-Build Project/)).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render build action for string content with preview updated message', () => {
      const content = '✅ Agent completed successfully. Project built and preview updated!';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText(/Build Project|Auto-Build Project/)).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render build action for string content with error message', () => {
      const content = '❌ Auto-build failed. Analyzing error and attempting to fix automatically...';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Auto-Build Project')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should render build action for array content with auto-build message', () => {
      const content = [
        { type: 'text' as const, text: '✅ Agent completed successfully. Project built and preview updated!' }
      ];

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Auto-Build Project')).toBeInTheDocument();
      expect(screen.getByText('Auto-build completed')).toBeInTheDocument();
    });

    it('should render build action for array content with loading message', () => {
      const content = [
        { type: 'text' as const, text: '🔄 Building project...' }
      ];

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Build Project')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should render build action for array content with deploy message', () => {
      const content = [
        { type: 'text' as const, text: '🎉 Deploy completed successfully!' }
      ];

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Deploy Project')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render build action for array content with auto-fix message', () => {
      const content = [
        { type: 'text' as const, text: '⚠️ Auto-fix attempt limit reached. Please fix the build error manually: Some error details' }
      ];

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Auto-Fix Error')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render regular markdown for non-build-action string content', () => {
      const content = 'Hello, I can help you with your project.';

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Hello, I can help you with your project.')).toBeInTheDocument();
      expect(screen.queryByText('Build Project')).not.toBeInTheDocument();
    });

    it('should render regular markdown for non-build-action array content', () => {
      const content = [
        { type: 'text' as const, text: 'Hello, I can help you with your project.' }
      ];

      render(
        <TestApp>
          <AssistantContent content={content} toolResults={mockToolResults} />
        </TestApp>
      );

      expect(screen.getByText('Hello, I can help you with your project.')).toBeInTheDocument();
      expect(screen.queryByText('Build Project')).not.toBeInTheDocument();
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