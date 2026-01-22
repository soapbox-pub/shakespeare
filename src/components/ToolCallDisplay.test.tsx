import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ToolCallDisplay } from './ToolCallDisplay';

describe('ToolCallDisplay', () => {
  describe('path stripping', () => {
    it('should strip project prefix from absolute paths for read tool', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="read"
            toolArgs={{ filePath: '/projects/mysite/src/index.ts' }}
            state="completed"
            result="File content"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Viewed src/index.ts')).toBeInTheDocument();
    });

    it('should strip project prefix from absolute paths for write tool', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="write"
            toolArgs={{ filePath: '/projects/mysite/src/App.tsx', content: 'code' }}
            state="completed"
            result="File written"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Wrote src/App.tsx')).toBeInTheDocument();
    });

    it('should strip project prefix from absolute paths for edit tool', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="edit"
            toolArgs={{ 
              filePath: '/projects/mysite/src/components/Header.tsx',
              oldString: 'old',
              newString: 'new'
            }}
            state="completed"
            result="File edited"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Edited src/components/Header.tsx')).toBeInTheDocument();
    });

    it('should handle paths without project prefix', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="read"
            toolArgs={{ filePath: 'src/index.ts' }}
            state="completed"
            result="File content"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Viewed src/index.ts')).toBeInTheDocument();
    });

    it('should handle legacy text_editor_view tool', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="text_editor_view"
            toolArgs={{ path: '/projects/mysite/README.md' }}
            state="completed"
            result="File content"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Viewed README.md')).toBeInTheDocument();
    });

    it('should handle legacy text_editor_write tool', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="text_editor_write"
            toolArgs={{ path: '/projects/mysite/package.json', file_text: '{}' }}
            state="completed"
            result="File written"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Wrote package.json')).toBeInTheDocument();
    });

    it('should handle legacy text_editor_str_replace tool', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="text_editor_str_replace"
            toolArgs={{ 
              path: '/projects/mysite/src/utils.ts',
              old_str: 'old',
              new_str: 'new'
            }}
            state="completed"
            result="File edited"
            projectId="mysite"
          />
        </TestApp>
      );

      expect(screen.getByText('Edited src/utils.ts')).toBeInTheDocument();
    });

    it('should handle different projects with same relative path', () => {
      render(
        <TestApp>
          <ToolCallDisplay
            toolName="read"
            toolArgs={{ filePath: '/projects/another-project/src/index.ts' }}
            state="completed"
            result="File content"
            projectId="another-project"
          />
        </TestApp>
      );

      expect(screen.getByText('Viewed src/index.ts')).toBeInTheDocument();
    });
  });
});
