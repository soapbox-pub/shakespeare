import { memo } from 'react';
import { Code } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Response } from '@/components/ai-elements/response';
import { DiffRenderer } from '@/components/ai/DiffRenderer';
import { ScriptRunner } from '@/components/ai/ScriptRunner';
import { FileViewer } from '@/components/ai/FileViewer';
import { FileWriter } from '@/components/ai/FileWriter';
import { ShellCommand } from '@/components/ai/ShellCommand';
import { PackageManager } from '@/components/ai/PackageManager';
import { GitCommit } from '@/components/ai/GitCommit';
import type { AssistantModelMessage } from 'ai';

interface AssistantContentProps {
  content: AssistantModelMessage['content'];
}

export const AssistantContent = memo(({ content }: AssistantContentProps) => {
  // Helper function to find tool result by call ID
  const findToolResult = (toolCallId: string) => {
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'tool-result' && part.toolCallId === toolCallId) {
          return part;
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
        <Response>{content}</Response>
      </div>
    );
  }

  return (
    <>
      {content.map((item, index) => {
        if (item.type === 'text') {
          return (
            <div key={index} className="prose prose-sm max-w-none dark:prose-invert">
              <Response>{item.text}</Response>
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