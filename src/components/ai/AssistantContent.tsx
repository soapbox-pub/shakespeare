import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Code } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DiffRenderer } from '@/components/ai/DiffRenderer';
import { ScriptRunner } from '@/components/ai/ScriptRunner';
import { FileViewer } from '@/components/ai/FileViewer';
import { FileWriter } from '@/components/ai/FileWriter';
import { ShellCommand } from '@/components/ai/ShellCommand';
import { PackageManager } from '@/components/ai/PackageManager';
import { GitCommit } from '@/components/ai/GitCommit';
import type { CoreAssistantMessage, CoreToolMessage } from 'ai';

interface AssistantContentProps {
  content: CoreAssistantMessage['content'];
  toolResults?: CoreToolMessage[];
}

export const AssistantContent = memo(({ content, toolResults = [] }: AssistantContentProps) => {
  // Helper function to find tool result by call ID
  const findToolResult = (toolCallId: string) => {
    for (const toolMessage of toolResults) {
      if (toolMessage.content) {
        for (const resultPart of toolMessage.content) {
          if (resultPart.toolCallId === toolCallId) {
            return resultPart;
          }
        }
      }
    }
    return null;
  };

  // Helper function to extract result text and error status
  const extractToolResult = (toolCallId: string): { result?: string; isError: boolean } => {
    const toolResult = findToolResult(toolCallId);

    if (!toolResult) {
      return { isError: false };
    }

    // Handle direct string results
    if (toolResult.output.type === 'text') {
      return {
        result: toolResult.output.value,
        isError: false
      };
    }

    return { isError: true };
  };
  // Handle string content (simple text messages)
  if (typeof content === 'string') {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Customize code blocks to match the existing tool styling
            pre: ({ children }) => (
              <pre className="bg-muted/50 rounded p-3 overflow-x-auto text-sm">
                {children}
              </pre>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                    {children}
                  </code>
                );
              }
              return <code className={className}>{children}</code>;
            },
            // Style links
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            ),
            // Style blockquotes
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <>
      {content.map((item, index) => {
        if (item.type === 'text') {
          return (
            <div key={index} className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Customize code blocks to match the existing tool styling
                  pre: ({ children }) => (
                    <pre className="bg-muted/50 rounded p-3 overflow-x-auto text-sm">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                          {children}
                        </code>
                      );
                    }
                    return <code className={className}>{children}</code>;
                  },
                  // Style links
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  // Style blockquotes
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic text-muted-foreground">
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {item.text}
              </ReactMarkdown>
            </div>
          );
        } else if (item.type === 'tool-call') {
          // Special rendering for text_editor_str_replace tool
          if (item.toolName === 'text_editor_str_replace' && item.input) {
            const { path, old_str, new_str } = item.input as { path: string; old_str: string; new_str: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <DiffRenderer
                key={index}
                path={path}
                oldStr={old_str}
                newStr={new_str}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for run_script tool
          if (item.toolName === 'run_script' && item.input) {
            const { script } = item.input as { script: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <ScriptRunner
                key={index}
                script={script}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for text_editor_view tool
          if (item.toolName === 'text_editor_view' && item.input) {
            const { path } = item.input as { path: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <FileViewer
                key={index}
                path={path}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for text_editor_write tool
          if (item.toolName === 'text_editor_write' && item.input) {
            const { path, file_text } = item.input as { path: string; file_text: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <FileWriter
                key={index}
                path={path}
                fileText={file_text}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for shell tool
          if (item.toolName === 'shell' && item.input) {
            const { command } = item.input as { command: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <ShellCommand
                key={index}
                command={command}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for npm_add_package tool
          if (item.toolName === 'npm_add_package' && item.input) {
            const { name, version, dev } = item.input as { name: string; version?: string; dev?: boolean };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <PackageManager
                key={index}
                action="add"
                registry="npm"
                packageName={name}
                version={version}
                dev={dev}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for npm_remove_package tool
          if (item.toolName === 'npm_remove_package' && item.input) {
            const { name } = item.input as { name: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <PackageManager
                key={index}
                action="remove"
                registry="npm"
                packageName={name}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for jsr_add_package tool
          if (item.toolName === 'jsr_add_package' && item.input) {
            const { name, version, dev } = item.input as { name: string; version?: string; dev?: boolean };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <PackageManager
                key={index}
                action="add"
                registry="jsr"
                packageName={name}
                version={version}
                dev={dev}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for jsr_remove_package tool
          if (item.toolName === 'jsr_remove_package' && item.input) {
            const { name } = item.input as { name: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <PackageManager
                key={index}
                action="remove"
                registry="jsr"
                packageName={name}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for git_commit tool
          if (item.toolName === 'git_commit' && item.input) {
            const { message } = item.input as { message: string };
            const { result, isError } = extractToolResult(item.toolCallId);

            return (
              <GitCommit
                key={index}
                message={message}
                result={result}
                isError={isError}
              />
            );
          }

          // Default tool rendering for other tools
          return (
            <Card key={index} className="mt-2 bg-muted/50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-4 w-4 flex-shrink-0" />
                  <span className="font-mono text-sm break-all">{String(item.toolName)}</span>
                </div>
                {item.input && typeof item.input === 'object' && item.input !== null && Object.keys(item.input).length > 0 ? (
                  <div className="text-xs text-muted-foreground mb-2">
                    <pre className="overflow-hidden text-ellipsis">
                      {JSON.stringify(item.input, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        }
        return null;
      })}
    </>
  );
});

AssistantContent.displayName = 'AssistantContent';