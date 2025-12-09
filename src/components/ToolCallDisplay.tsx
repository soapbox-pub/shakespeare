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
  Settings,
  TriangleAlert,
  X,
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
  errorTitle?: string; // Title to show when error occurs (e.g., "Failed to edit {path}")
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
        errorTitle: args.command ? `Failed: ${String(args.command)}` : 'Shell Command Failed',
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
        errorTitle: `Failed to view ${path}${lineInfo}`,
      };
    }

    case 'text_editor_write':
      return {
        icon: FileText,
        title: args.path ? `Wrote ${args.path}` : 'Wrote File',
        callingTitle: args.path ? `Writing ${args.path}` : 'Writing File',
        errorTitle: args.path ? `Failed to write ${args.path}` : 'Failed to Write File',
      };

    case 'text_editor_str_replace':
      return {
        icon: Edit,
        title: args.path ? `Edited ${args.path}` : 'Edited File',
        callingTitle: args.path ? `Editing ${args.path}` : 'Editing File',
        errorTitle: args.path ? `Failed to edit ${args.path}` : 'Failed to Edit File',
      };

    case 'npm_add_package': {
      const name = args.name ? String(args.name) : 'Package';
      const devSuffix = args.dev ? ' (dev)' : '';
      return {
        icon: Package,
        title: `Installed ${name}${devSuffix}`,
        callingTitle: `Installing ${name}${devSuffix}`,
        errorTitle: `Failed to install ${name}${devSuffix}`,
      };
    }

    case 'npm_remove_package':
      return {
        icon: PackageMinus,
        title: args.name ? `Removed ${args.name}` : 'Removed Package',
        callingTitle: args.name ? `Removing ${args.name}` : 'Removing Package',
        errorTitle: args.name ? `Failed to remove ${args.name}` : 'Failed to Remove Package',
      };

    case 'git_commit':
      return {
        icon: GitCommit,
        title: args.message ? `Committed: ${args.message}` : 'Committed Changes',
        callingTitle: args.message ? `Committing: ${args.message}` : 'Committing Changes',
        errorTitle: 'Failed to Commit Changes',
      };

    case 'build_project':
      return {
        icon: Package,
        title: 'Built Project',
        callingTitle: 'Building Project',
        errorTitle: 'Failed to Build Project',
      };

    case 'nostr_read_nip':
      return {
        icon: BookOpen,
        title: args.nip ? `Read NIP-${args.nip}` : 'Read NIP',
        callingTitle: args.nip ? `Reading NIP-${args.nip}` : 'Reading NIP',
        errorTitle: args.nip ? `Failed to read NIP-${args.nip}` : 'Failed to Read NIP',
      };

    case 'nostr_fetch_event':
      return {
        icon: Download,
        title: args.identifier ? `Fetched ${String(args.identifier).slice(0, 16)}...` : 'Fetched Event',
        callingTitle: args.identifier ? `Fetching ${String(args.identifier).slice(0, 16)}...` : 'Fetching Event',
        errorTitle: args.identifier ? `Failed to fetch ${String(args.identifier).slice(0, 16)}...` : 'Failed to Fetch Event',
      };

    case 'nostr_read_kind':
      return {
        icon: Hash,
        title: args.kind !== undefined ? `Read Kind ${args.kind}` : 'Read Kind',
        callingTitle: args.kind !== undefined ? `Reading Kind ${args.kind}` : 'Reading Kind',
        errorTitle: args.kind !== undefined ? `Failed to read Kind ${args.kind}` : 'Failed to Read Kind',
      };

    case 'nostr_read_tag':
      return {
        icon: Tag,
        title: args.tag ? `Read Tag "${args.tag}"` : 'Read Tag',
        callingTitle: args.tag ? `Reading Tag "${args.tag}"` : 'Reading Tag',
        errorTitle: args.tag ? `Failed to read Tag "${args.tag}"` : 'Failed to Read Tag',
      };

    case 'nostr_read_protocol':
      return {
        icon: Network,
        title: args.doc ? `Read Protocol: ${args.doc}` : 'Read Protocol',
        callingTitle: args.doc ? `Reading Protocol: ${args.doc}` : 'Reading Protocol',
        errorTitle: args.doc ? `Failed to read Protocol: ${args.doc}` : 'Failed to Read Protocol',
      };

    case 'nostr_read_nips_index':
      return {
        icon: List,
        title: 'Read NIPs Index',
        callingTitle: 'Reading NIPs Index',
        errorTitle: 'Failed to Read NIPs Index',
      };

    case 'nostr_generate_kind':
      return {
        icon: Plus,
        title: args.range ? `Generated ${args.range} kind` : 'Generated Kind',
        callingTitle: args.range ? `Generating ${args.range} kind` : 'Generating Kind',
        errorTitle: args.range ? `Failed to generate ${args.range} kind` : 'Failed to Generate Kind',
      };

    case 'nostr_publish_events': {
      const eventCount = Array.isArray(args.events) ? args.events.length : 0;
      return {
        icon: Send,
        title: eventCount > 1 ? `Published ${eventCount} Nostr events` : 'Published Nostr event',
        callingTitle: eventCount > 1 ? `Publishing ${eventCount} Nostr events` : 'Publishing Nostr event',
        errorTitle: eventCount > 1 ? `Failed to publish ${eventCount} Nostr events` : 'Failed to Publish Nostr Event',
      };
    }

    case 'deploy_project':
      return {
        icon: Globe,
        title: args.deployServer ? `Deployed to ${args.deployServer}` : 'Deployed Project',
        callingTitle: args.deployServer ? `Deploying to ${args.deployServer}` : 'Deploying Project',
        errorTitle: args.deployServer ? `Failed to deploy to ${args.deployServer}` : 'Failed to Deploy Project',
      };

    case 'read_console_messages':
      return {
        icon: Logs,
        title: 'Read Console',
        callingTitle: 'Reading Console',
        errorTitle: 'Failed to Read Console',
      };

    case 'skill':
      return {
        icon: Puzzle,
        title: args.name ? `Skill: ${args.name}` : 'Skill',
        callingTitle: args.name ? `Running Skill: ${args.name}` : 'Running Skill',
        errorTitle: args.name ? `Skill Failed: ${args.name}` : 'Skill Failed',
      };

    case 'generate_image':
      return {
        icon: Image,
        title: args.prompt ? String(args.prompt) : 'Generated Image',
        callingTitle: args.prompt ? String(args.prompt) : 'Generating Image',
        errorTitle: 'Failed to Generate Image',
      };

    case 'view_available_models':
      return {
        icon: Eye,
        title: 'Viewed Available Models',
        callingTitle: 'Viewing Available Models',
        errorTitle: 'Failed to View Available Models',
      };

    case 'configure_image_generation':
      return {
        icon: Settings,
        title: args.model ? `Configured image model: ${args.model}` : 'Configured Image Generation',
        callingTitle: args.model ? `Configuring image model: ${args.model}` : 'Configuring Image Generation',
        errorTitle: args.model ? `Failed to configure image model: ${args.model}` : 'Failed to Configure Image Generation',
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
 * Parse tool error from result string
 * Format: "Error with tool {toolName}: {errorMsg}"
 * Returns null if not an error or if format doesn't match exactly
 */
function parseToolError(result: string | undefined, expectedToolName: string): string | null {
  if (!result) return null;

  // Strict parsing - exact format required
  const prefix = `Error with tool ${expectedToolName}: `;
  if (!result.startsWith(prefix)) return null;

  // Extract error message after the prefix
  return result.substring(prefix.length);
}

/**
 * Unified component for displaying tool calls in all states
 */
export function ToolCallDisplay({ toolName, toolArgs, state, result }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);

  const toolInfo = getToolInfo(toolName, toolArgs);
  const IconComponent = toolInfo.icon;

  // Check if this is an error result
  const errorMessage = state === 'completed' ? parseToolError(result, toolName) : null;
  const hasError = errorMessage !== null;

  // Determine which title to show based on state
  let displayTitle: string;
  if (hasError && toolInfo.errorTitle) {
    displayTitle = toolInfo.errorTitle;
  } else if (state === 'completed') {
    displayTitle = toolInfo.title;
  } else {
    displayTitle = toolInfo.callingTitle || toolInfo.title;
  }

  // Only allow clicking when completed
  const isClickable = state === 'completed';

  // Render special content for specific tools when expanded
  const renderExpandedContent = () => {
    if (!result || !isExpanded) return null;

    // Show error message if present and expanded
    if (hasError) {
      return (
        <div className="mt-1 p-3 bg-destructive/5 rounded border border-destructive/20 text-xs">
          <div className="flex gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="whitespace-pre-wrap break-words text-foreground">
              {errorMessage}
            </div>
          </div>
        </div>
      );
    }

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
    if (hasError) return null;
    if (toolName !== 'generate_image') return null;

    // Show placeholder while generating (calling or waiting states)
    if (state === 'calling' || state === 'waiting') {
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

    // For completed state, we need the result
    if (!result) return null;

    // Parse "Generated image: /tmp/filename.png" from result
    const match = result.match(/Generated image:\s*(\/tmp\/[^\s\n]+)/);
    if (match) {
      const imagePath = match[1];
      const filename = imagePath.split('/').pop() || imagePath;

      // Hide the image section if there was a load error
      if (imageLoadError) return null;

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
              onError={() => setImageLoadError(true)}
            />
          </div>
        </div>
      );
    } else {
      // Image generation failed - show error in place
      return <ImageGenerationError />;
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
          ) : hasError ? (
            <X className="h-3 w-3 text-muted-foreground flex-shrink-0" />
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
