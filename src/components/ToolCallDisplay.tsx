import { useState } from 'react';
import {
  Wrench,
  Eye,
  FileText,
  Edit,
  Package,
  PackageMinus,
  GitCommit,
  BookOpen,
  Download,
  Hash,
  Tag,
  Network,
  List,
  Plus,
  Terminal,
  Globe,
  Loader2,
  Logs,
  Send,
  Puzzle,
  Image,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VFSImage } from '@/components/VFSImage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageModelDialog } from '@/components/ImageModelDialog';
import { ImageLightbox } from '@/components/ImageLightbox';

interface ToolInfo {
  icon: LucideIcon;
  title: string;
  callingTitle?: string; // Title to show while calling (e.g., "Editing {path}")
}

interface ToolCallDisplayProps {
  toolName: string;
  toolArgs: Record<string, unknown>;
  state: 'calling' | 'waiting' | 'completed';
  result?: string; // The tool result content (only for completed state)
}

// Component to show image generation errors inline
function ImageGenerationError() {
  const [showImageModelDialog, setShowImageModelDialog] = useState(false);

  return (
    <>
      <div className="mt-1 max-w-xs">
        <Alert variant="default" className="border-primary/20 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <span className="text-foreground">
              Image generation failed. This could be due to an issue with the selected image model or the AI provider.{' '}
            </span>
            <button
              className="text-primary underline hover:no-underline font-medium"
              onClick={() => setShowImageModelDialog(true)}
            >
              Change image model
            </button>
          </AlertDescription>
        </Alert>
      </div>
      <ImageModelDialog
        open={showImageModelDialog}
        onOpenChange={setShowImageModelDialog}
      />
    </>
  );
}

/**
 * Get tool information including icon, title, and calling title
 */
function getToolInfo(toolName: string, args: Record<string, unknown>): ToolInfo {
  switch (toolName) {
    case 'shell':
      return {
        icon: Terminal,
        title: args.command ? String(args.command) : 'Shell Command',
        callingTitle: args.command ? String(args.command) : 'Running Shell Command',
      };

    case 'text_editor_view': {
      const path = args.path ? String(args.path) : 'File';
      const hasLineRange = args.start_line || args.end_line;
      const lineInfo = hasLineRange
        ? ` (lines ${args.start_line || 1}-${args.end_line || 'end'})`
        : '';
      return {
        icon: Eye,
        title: `Viewed ${path}${lineInfo}`,
        callingTitle: `Viewing ${path}${lineInfo}`,
      };
    }

    case 'text_editor_write':
      return {
        icon: FileText,
        title: args.path ? `Wrote ${args.path}` : 'Wrote File',
        callingTitle: args.path ? `Writing ${args.path}` : 'Writing File',
      };

    case 'text_editor_str_replace':
      return {
        icon: Edit,
        title: args.path ? `Edited ${args.path}` : 'Edited File',
        callingTitle: args.path ? `Editing ${args.path}` : 'Editing File',
      };

    case 'npm_add_package': {
      const name = args.name ? String(args.name) : 'Package';
      const devSuffix = args.dev ? ' (dev)' : '';
      return {
        icon: Package,
        title: `Installed ${name}${devSuffix}`,
        callingTitle: `Installing ${name}${devSuffix}`,
      };
    }

    case 'npm_remove_package':
      return {
        icon: PackageMinus,
        title: args.name ? `Removed ${args.name}` : 'Removed Package',
        callingTitle: args.name ? `Removing ${args.name}` : 'Removing Package',
      };

    case 'git_commit':
      return {
        icon: GitCommit,
        title: args.message ? `Committed: ${args.message}` : 'Committed Changes',
        callingTitle: args.message ? `Committing: ${args.message}` : 'Committing Changes',
      };

    case 'build_project':
      return {
        icon: Package,
        title: 'Built Project',
        callingTitle: 'Building Project',
      };

    case 'nostr_read_nip':
      return {
        icon: BookOpen,
        title: args.nip ? `Read NIP-${args.nip}` : 'Read NIP',
        callingTitle: args.nip ? `Reading NIP-${args.nip}` : 'Reading NIP',
      };

    case 'nostr_fetch_event':
      return {
        icon: Download,
        title: args.identifier ? `Fetched ${String(args.identifier).slice(0, 16)}...` : 'Fetched Event',
        callingTitle: args.identifier ? `Fetching ${String(args.identifier).slice(0, 16)}...` : 'Fetching Event',
      };

    case 'nostr_read_kind':
      return {
        icon: Hash,
        title: args.kind !== undefined ? `Read Kind ${args.kind}` : 'Read Kind',
        callingTitle: args.kind !== undefined ? `Reading Kind ${args.kind}` : 'Reading Kind',
      };

    case 'nostr_read_tag':
      return {
        icon: Tag,
        title: args.tag ? `Read Tag "${args.tag}"` : 'Read Tag',
        callingTitle: args.tag ? `Reading Tag "${args.tag}"` : 'Reading Tag',
      };

    case 'nostr_read_protocol':
      return {
        icon: Network,
        title: args.doc ? `Read Protocol: ${args.doc}` : 'Read Protocol',
        callingTitle: args.doc ? `Reading Protocol: ${args.doc}` : 'Reading Protocol',
      };

    case 'nostr_read_nips_index':
      return {
        icon: List,
        title: 'Read NIPs Index',
        callingTitle: 'Reading NIPs Index',
      };

    case 'nostr_generate_kind':
      return {
        icon: Plus,
        title: args.range ? `Generated ${args.range} kind` : 'Generated Kind',
        callingTitle: args.range ? `Generating ${args.range} kind` : 'Generating Kind',
      };

    case 'nostr_publish_events': {
      const eventCount = Array.isArray(args.events) ? args.events.length : 0;
      return {
        icon: Send,
        title: eventCount > 1 ? `Published ${eventCount} Nostr events` : 'Published Nostr event',
        callingTitle: eventCount > 1 ? `Publishing ${eventCount} Nostr events` : 'Publishing Nostr event',
      };
    }

    case 'deploy_project':
      return {
        icon: Globe,
        title: args.deployServer ? `Deployed to ${args.deployServer}` : 'Deployed Project',
        callingTitle: args.deployServer ? `Deploying to ${args.deployServer}` : 'Deploying Project',
      };

    case 'read_console_messages':
      return {
        icon: Logs,
        title: 'Read Console',
        callingTitle: 'Reading Console',
      };

    case 'skill':
      return {
        icon: Puzzle,
        title: args.name ? `Skill: ${args.name}` : 'Skill',
        callingTitle: args.name ? `Running Skill: ${args.name}` : 'Running Skill',
      };

    case 'generate_image':
      return {
        icon: Image,
        title: args.prompt ? String(args.prompt) : 'Generated Image',
        callingTitle: args.prompt ? String(args.prompt) : 'Generating Image',
      };

    default: {
      const formattedName = toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return {
        icon: Wrench,
        title: formattedName,
        callingTitle: formattedName,
      };
    }
  }
}

/**
 * Unified component for displaying tool calls in all states
 */
export function ToolCallDisplay({ toolName, toolArgs, state, result }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  const toolInfo = getToolInfo(toolName, toolArgs);
  const IconComponent = toolInfo.icon;

  // Determine which title to show based on state
  const displayTitle = state === 'completed'
    ? toolInfo.title
    : (toolInfo.callingTitle || toolInfo.title);

  // Only allow clicking when completed
  const isClickable = state === 'completed';

  // Render special content for specific tools when expanded
  const renderExpandedContent = () => {
    if (!result || !isExpanded) return null;

    if (toolName === 'text_editor_write' && typeof toolArgs.file_text === 'string') {
      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
          <div className="whitespace-pre-wrap break-words font-mono">
            {toolArgs.file_text}
          </div>
        </div>
      );
    }

    if (toolName === 'text_editor_str_replace' && typeof toolArgs.old_str === 'string' && typeof toolArgs.new_str === 'string') {
      const oldLines = String(toolArgs.old_str).split('\n');
      const newLines = String(toolArgs.new_str).split('\n');

      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border text-xs font-mono">
          <div className="space-y-1">
            {/* Old content (removed) */}
            <div className="space-y-0">
              {oldLines.map((line, index) => (
                <div key={`old-${index}`} className="flex">
                  <span className="text-red-500 select-none mr-2">-</span>
                  <span className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 flex-1 whitespace-pre-wrap break-words">
                    {line}
                  </span>
                </div>
              ))}
            </div>

            {/* New content (added) */}
            <div className="space-y-0">
              {newLines.map((line, index) => (
                <div key={`new-${index}`} className="flex">
                  <span className="text-green-500 select-none mr-2">+</span>
                  <span className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 flex-1 whitespace-pre-wrap break-words">
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (toolName === 'generate_image') {
      // For generate_image, when expanded show the full prompt
      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
          <div>{typeof toolArgs.prompt === 'string' ? toolArgs.prompt : 'No prompt provided'}</div>
        </div>
      );
    }

    // Default rendering for other tools
    return (
      <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
        <div className="whitespace-pre-wrap break-words font-mono">
          {result}
        </div>
      </div>
    );
  };

  // Special rendering for generate_image - always show image below the tool
  const renderImageBelowTool = () => {
    if (toolName !== 'generate_image' || !result) return null;

    // Parse "Generated image: /tmp/filename.png" from result
    const match = result.match(/Generated image:\s*(\/tmp\/[^\s\n]+)/);
    if (match) {
      const imagePath = match[1];
      const filename = imagePath.split('/').pop() || imagePath;

      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border max-w-xs">
          <div
            className="cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setExpandedImageUrl(imagePath)}
          >
            <VFSImage
              path={imagePath}
              alt={filename}
              className="max-w-full h-auto rounded"
            />
          </div>
        </div>
      );
    } else if (state === 'completed') {
      // Image generation failed - show error in place
      return <ImageGenerationError />;
    } else if (state === 'calling' || state === 'waiting') {
      // Show placeholder while generating
      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border max-w-xs">
          <div className="relative w-full aspect-square">
            <div className="w-full h-full rounded bg-muted/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-12 w-12 text-muted-foreground/30 animate-spin" />
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <>
      <div className="-mt-2">
        <button
          onClick={() => isClickable && setIsExpanded(!isExpanded)}
          disabled={!isClickable}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1 text-xs",
            isClickable && "hover:bg-muted/30 rounded transition-colors duration-200",
            !isClickable && "cursor-default"
          )}
        >
          {state === 'calling' || state === 'waiting' ? (
            <Loader2 className="h-3 w-3 text-muted-foreground flex-shrink-0 animate-spin" />
          ) : (
            <IconComponent className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-muted-foreground font-medium truncate flex-1 text-left">
            {displayTitle}
          </span>
        </button>

        {renderExpandedContent()}
        {renderImageBelowTool()}
      </div>

      {/* Image expansion lightbox */}
      <ImageLightbox
        imageUrl={expandedImageUrl}
        onClose={() => setExpandedImageUrl(null)}
      />
    </>
  );
}
