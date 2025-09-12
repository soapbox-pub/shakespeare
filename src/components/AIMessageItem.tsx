import { memo, useState } from 'react';
import { Streamdown } from 'streamdown';
import { Wrench, Eye, FileText, Edit, Package, PackageMinus, GitCommit, BookOpen, Download, Hash, Tag, Network, List, Plus, Terminal, Globe, CheckCircle } from 'lucide-react';
import type { AIMessage } from '@/lib/SessionManager';
import { cn } from '@/lib/utils';
import OpenAI from 'openai';

interface AIMessageItemProps {
  message: AIMessage;
  isCurrentlyLoading?: boolean;
  toolCall?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall | undefined; // Tool call data passed from the assistant message
}

export const AIMessageItem = memo(({
  message,
  isCurrentlyLoading = false,
  toolCall
}: AIMessageItemProps) => {
  const [isToolExpanded, setIsToolExpanded] = useState(false);

  // Get content to display
  const getContent = () => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      // Handle array content (like images, text blocks)
      return message.content
        .map(item => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          if (item.type === 'image_url') return `[Image: ${item.image_url.url}]`;
          return '[Unknown content]';
        })
        .join('\n');
    }
    return '';
  };

  // Get tool info including icon and title
  const getToolInfo = () => {
    if (message.role === 'tool' && toolCall) {
      if (toolCall.type === 'function') {
        const toolName = toolCall.function.name;
        let args;

        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        // Generate icons and titles based on tool name and arguments
        switch (toolName) {
          case 'shell':
            return {
              icon: Terminal,
              title: args.command ? args.command : 'Shell Command'
            };
          case 'text_editor_view': {
            const title = args.path
              ? (args.start_line || args.end_line
                  ? `Viewed ${args.path} (lines ${args.start_line || 1}-${args.end_line || 'end'})`
                  : `Viewed ${args.path}`)
              : 'Viewed File';
            return { icon: Eye, title };
          }
          case 'text_editor_write':
            return {
              icon: FileText,
              title: args.path ? `Wrote ${args.path}` : 'Wrote File'
            };
          case 'text_editor_str_replace':
            return {
              icon: Edit,
              title: args.path ? `Edited ${args.path}` : 'Edited File'
            };
          case 'npm_add_package': {
            const installTitle = args.name
              ? (args.dev ? `Installed ${args.name} (dev)` : `Installed ${args.name}`)
              : 'Installed Package';
            return { icon: Package, title: installTitle };
          }
          case 'npm_remove_package':
            return {
              icon: PackageMinus,
              title: args.name ? `Removed ${args.name}` : 'Removed Package'
            };
          case 'git_commit':
            return {
              icon: GitCommit,
              title: args.message ? `Committed: ${args.message}` : 'Committed Changes'
            };
          case 'build_project':
            return {
              icon: Package,
              title: 'Built Project'
            };
          case 'nostr_read_nip':
            return {
              icon: BookOpen,
              title: args.nip ? `Read NIP-${args.nip}` : 'Read NIP'
            };
          case 'nostr_fetch_event':
            return {
              icon: Download,
              title: args.identifier ? `Fetched ${args.identifier.slice(0, 16)}...` : 'Fetched Event'
            };
          case 'nostr_read_kind':
            return {
              icon: Hash,
              title: args.kind !== undefined ? `Read Kind ${args.kind}` : 'Read Kind'
            };
          case 'nostr_read_tag':
            return {
              icon: Tag,
              title: args.tag ? `Read Tag "${args.tag}"` : 'Read Tag'
            };
          case 'nostr_read_protocol':
            return {
              icon: Network,
              title: args.doc ? `Read Protocol: ${args.doc}` : 'Read Protocol'
            };
          case 'nostr_read_nips_index':
            return {
              icon: List,
              title: 'Read NIPs Index'
            };
          case 'nostr_generate_kind':
            return {
              icon: Plus,
              title: args.range ? `Generated ${args.range} kind` : 'Generated Kind'
            };
          case 'deploy_project':
            return {
              icon: Globe,
              title: args.deployServer ? `Deployed to ${args.deployServer}` : 'Deployed Project'
            };
          case 'typecheck':
            return {
              icon: CheckCircle,
              title: 'TypeScript'
            };
          default:
            return {
              icon: Wrench,
              title: toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            };
        }
      }
    }

    // Fallback to extracting from content
    if (message.role === 'tool') {
      const content = getContent();
      const lines = content.split('\n');
      const firstLine = lines[0];

      if (firstLine && firstLine.length < 100) {
        return {
          icon: Wrench,
          title: firstLine.replace(/^(Error |Tool |Executing |Result: )/i, '').trim()
        };
      }

      return { icon: Wrench, title: 'Tool Result' };
    }

    return { icon: Wrench, title: 'Tool' };
  };

  // Special rendering for tool messages
  if (message.role === 'tool') {
    const content = getContent();
    const toolInfo = getToolInfo();
    const IconComponent = toolInfo.icon;

    // Regular tool message rendering
    return (
      <div className="-mt-2"> {/* -mt-2 to make it snug with the previous assistant message */}
        <button
          onClick={() => setIsToolExpanded(!isToolExpanded)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1 text-xs",
            "hover:bg-muted/30 rounded transition-colors duration-200"
          )}
        >
          <IconComponent className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground font-medium truncate flex-1 text-left">
            {toolInfo.title}
          </span>
        </button>

        {isToolExpanded && (
          <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
            <div className="whitespace-pre-wrap break-words font-mono">
              {content}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Regular rendering for non-tool messages
  if (message.role === 'user') {
    // User messages: right-aligned bubble without avatar/name
    return (
      <div className="flex justify-end py-6">
        <div className="max-w-[80%] bg-secondary rounded-2xl rounded-br-md px-4 py-3">
          <div className="text-sm whitespace-pre-wrap break-words">
            {getContent()}
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages: left-aligned without avatar/name
  return (
    <div className="flex">
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <div className="break-words">
            <Streamdown
              className='size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
              parseIncompleteMarkdown={isCurrentlyLoading}
            >
              {getContent()}
            </Streamdown>
          </div>

          {/* Tool calls are now hidden from assistant messages */}
        </div>
      </div>
    </div>
  );
});

AIMessageItem.displayName = 'AIMessageItem';