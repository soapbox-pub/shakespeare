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
import type { CoreAssistantMessage, CoreToolMessage } from 'ai';

interface AssistantContentProps {
  content: CoreAssistantMessage['content'];
  allMessages?: unknown[];
}

export const AssistantContent = memo(({ content, allMessages = [] }: AssistantContentProps) => {
  // Helper function to find tool result for a given tool call
  const findToolResult = (toolCallId: string) => {
    // Look through all tool messages to find the one with our toolCallId
    for (const msg of allMessages) {
      if ((msg as { role: string }).role === 'tool') {
        const toolMessage = msg as CoreToolMessage;
        if (Array.isArray(toolMessage.content)) {
          const toolResultPart = toolMessage.content.find(
            part => part.type === 'tool-result' && part.toolCallId === toolCallId
          );
          if (toolResultPart) {
            return toolResultPart;
          }
        }
      }
    }
    return undefined;
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
          // Special rendering for js-dev__text_editor_str_replace tool
          if (item.toolName === 'js-dev__text_editor_str_replace' && item.args) {
            const { path, old_str, new_str } = item.args as { path: string; old_str: string; new_str: string };
            return (
              <DiffRenderer
                key={index}
                path={path}
                oldStr={old_str}
                newStr={new_str}
              />
            );
          }

          // Special rendering for js-dev__run_script tool
          if (item.toolName === 'js-dev__run_script' && item.args) {
            const { script } = item.args as { script: string };
            return (
              <ScriptRunner
                key={index}
                script={script}
              />
            );
          }

          // Special rendering for readFile tool
          if (item.toolName === 'readFile' && item.args) {
            const { filePath } = item.args as { filePath: string };
            const toolResultPart = findToolResult(item.toolCallId);
            let result: string | undefined;
            const isError = toolResultPart?.isError || false;

            if (toolResultPart && toolResultPart.result) {
              if (typeof toolResultPart.result === 'string') {
                result = toolResultPart.result;
              } else if (toolResultPart.result && typeof toolResultPart.result === 'object') {
                // Handle FsToolSet readFile result format: { content, success }
                const resultObj = toolResultPart.result as Record<string, unknown>;
                if (resultObj.content && typeof resultObj.content === 'string') {
                  result = resultObj.content;
                } else {
                  result = JSON.stringify(toolResultPart.result);
                }
              }
            }

            return (
              <FileViewer
                key={index}
                path={filePath}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for writeFile tool
          if (item.toolName === 'writeFile' && item.args) {
            const { filePath, content } = item.args as { filePath: string; content: string };
            const toolResultPart = findToolResult(item.toolCallId);
            let result: string | undefined;
            const isError = toolResultPart?.isError || false;

            if (toolResultPart && toolResultPart.result) {
              if (typeof toolResultPart.result === 'string') {
                result = toolResultPart.result;
              } else if (toolResultPart.result && typeof toolResultPart.result === 'object') {
                // Handle FsToolSet writeFile result format: { success, message }
                const resultObj = toolResultPart.result as Record<string, unknown>;
                if (resultObj.message && typeof resultObj.message === 'string') {
                  result = resultObj.message;
                } else {
                  result = JSON.stringify(toolResultPart.result);
                }
              }
            }

            return (
              <FileWriter
                key={index}
                path={filePath}
                fileText={content}
                result={result}
                isError={isError}
              />
            );
          }

          // Special rendering for js-dev__text_editor_view tool
          if (item.toolName === 'js-dev__text_editor_view' && item.args) {
            const { path } = item.args as { path: string };
            return (
              <FileViewer
                key={index}
                path={path}
              />
            );
          }

          // Special rendering for js-dev__text_editor_write tool
          if (item.toolName === 'js-dev__text_editor_write' && item.args) {
            const { path, file_text } = item.args as { path: string; file_text: string };
            return (
              <FileWriter
                key={index}
                path={path}
                fileText={file_text}
              />
            );
          }

          // Special rendering for js-dev__shell tool
          if (item.toolName === 'js-dev__shell' && item.args) {
            const { command } = item.args as { command: string };
            return (
              <ShellCommand
                key={index}
                command={command}
              />
            );
          }

          // Special rendering for js-dev__npm_add_package tool
          if (item.toolName === 'js-dev__npm_add_package' && item.args) {
            const { name, version, dev } = item.args as { name: string; version?: string; dev?: boolean };
            return (
              <PackageManager
                key={index}
                action="add"
                registry="npm"
                packageName={name}
                version={version}
                dev={dev}
              />
            );
          }

          // Special rendering for js-dev__npm_remove_package tool
          if (item.toolName === 'js-dev__npm_remove_package' && item.args) {
            const { name } = item.args as { name: string };
            return (
              <PackageManager
                key={index}
                action="remove"
                registry="npm"
                packageName={name}
              />
            );
          }

          // Special rendering for js-dev__jsr_add_package tool
          if (item.toolName === 'js-dev__jsr_add_package' && item.args) {
            const { name, version, dev } = item.args as { name: string; version?: string; dev?: boolean };
            return (
              <PackageManager
                key={index}
                action="add"
                registry="jsr"
                packageName={name}
                version={version}
                dev={dev}
              />
            );
          }

          // Special rendering for js-dev__jsr_remove_package tool
          if (item.toolName === 'js-dev__jsr_remove_package' && item.args) {
            const { name } = item.args as { name: string };
            return (
              <PackageManager
                key={index}
                action="remove"
                registry="jsr"
                packageName={name}
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
                {item.args && typeof item.args === 'object' && item.args !== null && Object.keys(item.args).length > 0 ? (
                  <div className="text-xs text-muted-foreground mb-2">
                    <pre className="overflow-hidden text-ellipsis">
                      {JSON.stringify(item.args, null, 2)}
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