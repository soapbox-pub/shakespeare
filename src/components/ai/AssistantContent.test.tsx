import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantContent } from './AssistantContent';
import { TestApp } from '@/test/TestApp';
import type { CoreToolMessage } from 'ai';

describe('AssistantContent', () => {
  const mockToolResults: CoreToolMessage[] = [];

  describe('Build Action Detection', () => {
    const testCases = [
      {
        name: 'auto-build success',
        content: '✅ Agent completed successfully. Project built and preview updated!',
        expectedTitle: 'Auto-Build Project',
        expectedStatus: 'Success'
      },
      {
        name: 'build error',
        content: '❌ Auto-build failed. Analyzing error and attempting to fix automatically...',
        expectedTitle: 'Auto-Build Project',
        expectedStatus: 'Failed'
      },
      {
        name: 'build loading',
        content: '🔄 Building project...',
        expectedTitle: 'Build Project',
        expectedStatus: 'Running'
      },
      {
        name: 'deploy success',
        content: '🎉 Deploy completed successfully!',
        expectedTitle: 'Deploy Project',
        expectedStatus: 'Success'
      },
      {
        name: 'auto-fix',
        content: '⚠️ Auto-fix attempt limit reached. Please fix the build error manually',
        expectedTitle: 'Auto-Fix Error',
        expectedStatus: 'Success'
      }
    ];

    testCases.forEach(({ name, content, expectedTitle, expectedStatus }) => {
      it(`should render ${name} action for string content`, () => {
        render(
          <TestApp>
            <AssistantContent content={content} toolResults={mockToolResults} />
          </TestApp>
        );

        expect(screen.getByText(expectedTitle)).toBeInTheDocument();
        expect(screen.getByText(expectedStatus)).toBeInTheDocument();
      });

      it(`should render ${name} action for array content`, () => {
        const arrayContent = [{ type: 'text' as const, text: content }];

        render(
          <TestApp>
            <AssistantContent content={arrayContent} toolResults={mockToolResults} />
          </TestApp>
        );

        expect(screen.getByText(expectedTitle)).toBeInTheDocument();
        expect(screen.getByText(expectedStatus)).toBeInTheDocument();
      });
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