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
  Search,
  Clipboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VFSImage } from '@/components/VFSImage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageModelDialog } from '@/components/ImageModelDialog';
import { ImageLightbox } from '@/components/ImageLightbox';
import { useFSPaths } from '@/hooks/useFSPaths';

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
  projectId: string; // Current project ID for path display
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
 * Strip project path prefix from absolute paths
 * e.g., /projects/mysite/src/index.ts -> src/index.ts
 */
function stripProjectPrefix(path: string, projectId?: string, projectsPath = '/projects'): string {
  if (!projectId) return path;
  
  const projectPrefix = `${projectsPath}/${projectId}/`;
  if (path === `${projectsPath}/${projectId}`) {
    return '.';
  } else if (path.startsWith(projectPrefix)) {
    return path.slice(projectPrefix.length);
  }
  
  return path;
}

/**
 * Get tool information including icon, title, and calling title
 */
function getToolInfo(toolName: string, args: Record<string, unknown>, projectId?: string, projectsPath?: string, result?: string): ToolInfo {
  switch (toolName) {
    case 'shell':
      return {
        icon: Terminal,
        title: args.command ? String(args.command) : 'Shell command',
        callingTitle: args.command ? String(args.command) : 'Running shell command',
        errorTitle: args.command ? `Failed: ${String(args.command)}` : 'Shell command failed',
      };

    // New tools (OpenCode-compatible names)
    case 'read': {
      const rawPath = args.filePath ? String(args.filePath) : 'File';
      const path = stripProjectPrefix(rawPath, projectId, projectsPath);
      const offset = typeof args.offset === 'number' ? args.offset : 0;
      const limit = typeof args.limit === 'number' ? args.limit : undefined;
      const lineInfo = (typeof offset === 'number' && typeof limit === 'number')
        ? ` (lines ${(offset || 0) + 1}-${limit ? offset + limit : ''})`
        : '';
      return {
        icon: Eye,
        title: `Viewed ${path}${lineInfo}`,
        callingTitle: `Viewing ${path}${lineInfo}`,
        errorTitle: `Failed to view ${path}${lineInfo}`,
      };
    }

    case 'write': {
      const rawPath = args.filePath ? String(args.filePath) : '';
      const path = rawPath ? stripProjectPrefix(rawPath, projectId, projectsPath) : '';
      return {
        icon: FileText,
        title: path ? `Wrote ${path}` : 'Wrote file',
        callingTitle: path ? `Writing ${path}` : 'Writing file',
        errorTitle: path ? `Failed to write ${path}` : 'Failed to write file',
      };
    }

    case 'edit': {
      const rawPath = args.filePath ? String(args.filePath) : '';
      const path = rawPath ? stripProjectPrefix(rawPath, projectId, projectsPath) : '';
      return {
        icon: Edit,
        title: path ? `Edited ${path}` : 'Edited file',
        callingTitle: path ? `Editing ${path}` : 'Editing file',
        errorTitle: path ? `Failed to edit ${path}` : 'Failed to edit file',
      };
    }

    case 'glob':
      return {
        icon: Search,
        title: args.pattern ? `Searched "${args.pattern}"` : 'File pattern search',
        callingTitle: args.pattern ? `Searching "${args.pattern}"` : 'Searching files',
        errorTitle: args.pattern ? `Failed to search ${args.pattern}` : 'Search failed',
      };

    case 'grep':
      return {
        icon: Search,
        title: args.pattern ? `Searched "${args.pattern}"` : 'Content search',
        callingTitle: args.pattern ? `Searching "${args.pattern}"` : 'Searching content',
        errorTitle: args.pattern ? `Failed to search ${args.pattern}` : 'Search failed',
      };

    // Legacy tools (kept for old chat history)
    case 'text_editor_view': {
      const rawPath = args.path ? String(args.path) : 'File';
      const path = stripProjectPrefix(rawPath, projectId, projectsPath);
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

    case 'text_editor_write': {
      const rawPath = args.path ? String(args.path) : '';
      const path = rawPath ? stripProjectPrefix(rawPath, projectId, projectsPath) : '';
      return {
        icon: FileText,
        title: path ? `Wrote ${path}` : 'Wrote file',
        callingTitle: path ? `Writing ${path}` : 'Writing file',
        errorTitle: path ? `Failed to write ${path}` : 'Failed to write file',
      };
    }

    case 'text_editor_str_replace': {
      const rawPath = args.path ? String(args.path) : '';
      const path = rawPath ? stripProjectPrefix(rawPath, projectId, projectsPath) : '';
      return {
        icon: Edit,
        title: path ? `Edited ${path}` : 'Edited file',
        callingTitle: path ? `Editing ${path}` : 'Editing file',
        errorTitle: path ? `Failed to edit ${path}` : 'Failed to edit file',
      };
    }

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
        title: args.name ? `Removed ${args.name}` : 'Removed package',
        callingTitle: args.name ? `Removing ${args.name}` : 'Removing package',
        errorTitle: args.name ? `Failed to remove ${args.name}` : 'Failed to remove package',
      };

    case 'git_commit':
      return {
        icon: GitCommit,
        title: args.message ? `Committed: ${args.message}` : 'Committed changes',
        callingTitle: args.message ? `Committing: ${args.message}` : 'Committing changes',
        errorTitle: 'Failed to commit changes',
      };

    case 'build_project':
      return {
        icon: Package,
        title: 'Built project',
        callingTitle: 'Building project',
        errorTitle: 'Failed to build project',
      };

    case 'nostr_read_nip':
      return {
        icon: BookOpen,
        title: args.nip ? `Read NIP-${args.nip}` : 'Read NIP',
        callingTitle: args.nip ? `Reading NIP-${args.nip}` : 'Reading NIP',
        errorTitle: args.nip ? `Failed to read NIP-${args.nip}` : 'Failed to read NIP',
      };

    case 'nostr_fetch_event':
      return {
        icon: Download,
        title: args.identifier ? `Viewed ${String(args.identifier).slice(0, 16)}...` : 'Viewed event',
        callingTitle: args.identifier ? `Viewing ${String(args.identifier).slice(0, 16)}...` : 'Viewing event',
        errorTitle: args.identifier ? `Failed to view ${String(args.identifier).slice(0, 16)}...` : 'Failed to view event',
      };

    case 'nostr_read_kind':
      return {
        icon: Hash,
        title: args.kind !== undefined ? `Viewed kind ${args.kind}` : 'Viewed kind',
        callingTitle: args.kind !== undefined ? `Viewing kind ${args.kind}` : 'Viewing kind',
        errorTitle: args.kind !== undefined ? `Failed to view kind ${args.kind}` : 'Failed to view kind',
      };

    case 'nostr_read_tag':
      return {
        icon: Tag,
        title: args.tag ? `Viewed tag "${args.tag}"` : 'Viewed tag',
        callingTitle: args.tag ? `Viewing tag "${args.tag}"` : 'Viewing tag',
        errorTitle: args.tag ? `Failed to view tag "${args.tag}"` : 'Failed to view tag',
      };

    case 'nostr_read_protocol':
      return {
        icon: Network,
        title: args.doc ? `Viewed protocol ${args.doc}` : 'Viewed protocol',
        callingTitle: args.doc ? `Viewing protocol ${args.doc}` : 'Viewing protocol',
        errorTitle: args.doc ? `Failed to view protocol ${args.doc}` : 'Failed to view protocol',
      };

    case 'nostr_read_nips_index':
      return {
        icon: List,
        title: 'Viewed NIPs index',
        callingTitle: 'Viewing NIPs index',
        errorTitle: 'Failed to view NIPs index',
      };

    case 'nostr_generate_kind':
      return {
        icon: Plus,
        title: args.range ? `Generated ${args.range} kind` : 'Generated kind',
        callingTitle: args.range ? `Generating ${args.range} kind` : 'Generating kind',
        errorTitle: args.range ? `Failed to generate ${args.range} kind` : 'Failed to generate kind',
      };

    case 'nostr_publish_events': {
      const eventCount = Array.isArray(args.events) ? args.events.length : 0;
      return {
        icon: Send,
        title: eventCount > 1 ? `Published ${eventCount} Nostr events` : 'Published Nostr event',
        callingTitle: eventCount > 1 ? `Publishing ${eventCount} Nostr events` : 'Publishing Nostr event',
        errorTitle: eventCount > 1 ? `Failed to publish ${eventCount} Nostr events` : 'Failed to publish Nostr event',
      };
    }

    case 'deploy_project':
      return {
        icon: Globe,
        title: args.deployServer ? `Deployed to ${args.deployServer}` : 'Deployed project',
        callingTitle: args.deployServer ? `Deploying to ${args.deployServer}` : 'Deploying project',
        errorTitle: args.deployServer ? `Failed to deploy to ${args.deployServer}` : 'Failed to deploy project',
      };

    case 'read_console_messages':
      return {
        icon: Logs,
        title: 'Viewed console',
        callingTitle: 'Viewing console',
        errorTitle: 'Failed to view console',
      };

    case 'webfetch': {
      const url = args.url ? String(args.url) : '';
      return {
        icon: Globe,
        title: url ? `Viewed ${url}` : 'Viewed webpage',
        callingTitle: url ? `Viewing ${url}` : 'Viewing webpage',
        errorTitle: url ? `Failed to view ${url}` : 'Failed to view webpage',
      };
    }

    case 'websearch': {
      const query = args.query ? String(args.query) : '';
      return {
        icon: Search,
        title: query ? `Searched "${query}"` : 'Web search',
        callingTitle: query ? `Searching "${query}"` : 'Searching web',
        errorTitle: query ? `Failed to search "${query}"` : 'Search failed',
      };
    }

    case 'skill':
      return {
        icon: Puzzle,
        title: args.name ? `Skill: ${args.name}` : 'Skill',
        callingTitle: args.name ? `Running skill: ${args.name}` : 'Running skill',
        errorTitle: args.name ? `Skill failed: ${args.name}` : 'Skill failed',
      };

    case 'generate_image':
      return {
        icon: Image,
        title: args.prompt ? String(args.prompt) : 'Generated image',
        callingTitle: args.prompt ? String(args.prompt) : 'Generating image',
        errorTitle: 'Failed to generate image',
      };

    case 'view_available_models':
      return {
        icon: Eye,
        title: 'Viewed available models',
        callingTitle: 'Viewing available models',
        errorTitle: 'Failed to view available models',
      };

    case 'configure_image_generation':
      return {
        icon: Settings,
        title: args.model ? `Configured image model: ${args.model}` : 'Configured image generation',
        callingTitle: args.model ? `Configuring image model: ${args.model}` : 'Configuring image generation',
        errorTitle: args.model ? `Failed to configure image model: ${args.model}` : 'Failed to configure image generation',
      };

    case 'todowrite':
    case 'todoread': {
      // Try to parse the result to get task counts for the title
      let title = toolName === 'todowrite' ? 'Updated todo list' : 'Viewed todo list';
      if (result) {
        try {
          const todos = JSON.parse(result);
          if (Array.isArray(todos)) {
            const activeTodos = todos.filter((x: { status: string }) => x.status !== 'completed' && x.status !== 'cancelled');
            const completedTodos = todos.filter((x: { status: string }) => x.status === 'completed');
            const inProgressTask = todos.find((x: { status: string }) => x.status === 'in_progress');
            
            // Format: "[<completed>/<total>] <active-task>" if in_progress task exists
            if (inProgressTask) {
              const taskName = inProgressTask.content || 'Task';
              const totalTasks = todos.length;
              title = `[${completedTodos.length + 1}/${totalTasks}] ${taskName}`;
            } else if (activeTodos.length === 0 && completedTodos.length > 0) {
              // All tasks completed
              title = `${completedTodos.length + 1} task${completedTodos.length !== 0 ? 's' : ''} completed`;
            } else if (completedTodos.length === 0) {
              // No completed tasks yet
              title = `${activeTodos.length} active task${activeTodos.length !== 1 ? 's' : ''}`;
            } else {
              title = `${activeTodos.length} active task${activeTodos.length !== 1 ? 's' : ''}, ${completedTodos.length} completed`;
            }
          }
        } catch {
          // If parsing fails, use default title
        }
      }
      return {
        icon: Clipboard,
        title,
        callingTitle: toolName === 'todowrite' ? 'Updating todo list' : 'Viewing todo list',
        errorTitle: toolName === 'todowrite' ? 'Failed to update todo list' : 'Failed to view todo list',
      };
    }

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
export function ToolCallDisplay({ toolName, toolArgs, state, result, projectId }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const { projectsPath } = useFSPaths();

  const toolInfo = getToolInfo(toolName, toolArgs, projectId, projectsPath, result);
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

    // Write tool expanded content (new and legacy)
    if ((toolName === 'write' && typeof toolArgs.content === 'string') || 
        (toolName === 'text_editor_write' && typeof toolArgs.file_text === 'string')) {
      const content = toolName === 'write' ? String(toolArgs.content) : String(toolArgs.file_text);
      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
          <div className="whitespace-pre-wrap break-words font-mono">
            {content}
          </div>
        </div>
      );
    }

    // Edit tool expanded content (new and legacy)
    if ((toolName === 'edit' && typeof toolArgs.oldString === 'string' && typeof toolArgs.newString === 'string') ||
        (toolName === 'text_editor_str_replace' && typeof toolArgs.old_str === 'string' && typeof toolArgs.new_str === 'string')) {
      const oldStr = toolName === 'edit' ? String(toolArgs.oldString) : String(toolArgs.old_str);
      const newStr = toolName === 'edit' ? String(toolArgs.newString) : String(toolArgs.new_str);
      const oldLines = oldStr.split('\n');
      const newLines = newStr.split('\n');

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

    // Read tool expanded content - parse and display file content nicely
    if (toolName === 'read' || toolName === 'text_editor_view') {
      // Parse the result to extract file content from <file> tags
      const fileMatch = result.match(/<file>\n([\s\S]*?)\n\n\((.*?)\)\n<\/file>/);
      if (fileMatch) {
        const fileContent = fileMatch[1];
        const footerMessage = fileMatch[2];
        
        // Split content into lines and parse line numbers
        const lines = fileContent.split('\n');
        
        return (
          <div className="mt-1 rounded border bg-background text-xs font-mono overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <div>
                {lines.map((line, idx) => {
                  // Parse line number and content (format: "    1| content")
                  const match = line.match(/^(\s*\d+)\|(.*)$/);
                  if (match) {
                    return (
                      <div key={idx} className="flex hover:bg-muted/30 transition-colors">
                        <div className="text-muted-foreground/60 select-none px-3 py-0.5 text-right min-w-[3rem] bg-muted/20">
                          {match[1].trim()}
                        </div>
                        <div className="flex-1 px-3 py-0.5 whitespace-pre-wrap break-words">
                          {match[2]}
                        </div>
                      </div>
                    );
                  }
                  // Fallback for lines that don't match expected format
                  return (
                    <div key={idx} className="px-3 py-0.5 whitespace-pre-wrap break-words">
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
            {footerMessage && (
              <div className="px-3 py-1.5 bg-muted/30 border-t text-muted-foreground text-[10px]">
                {footerMessage}
              </div>
            )}
          </div>
        );
      }
      // Fallback to default rendering if no <file> tags found
    }

    if (toolName === 'generate_image') {
      // For generate_image, when expanded show the full prompt
      return (
        <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
          <div>{typeof toolArgs.prompt === 'string' ? toolArgs.prompt : 'No prompt provided'}</div>
        </div>
      );
    }

    // Todo tools expanded content
    if (toolName === 'todowrite' || toolName === 'todoread') {
      try {
        const todos = JSON.parse(result);
        if (!Array.isArray(todos)) {
          throw new Error('Invalid todo format');
        }

        if (todos.length === 0) {
          return (
            <div className="mt-1 p-3 bg-muted/30 rounded border text-xs">
              <div className="text-muted-foreground italic">No todos found</div>
            </div>
          );
        }

        // Find the first in_progress task for bold styling
        const firstInProgressIndex = todos.findIndex((x: { status: string }) => x.status === 'in_progress');

        return (
          <div className="mt-1 rounded border bg-muted/30 text-xs overflow-hidden">
            <div className="px-3 py-2 space-y-1">
              {todos.map((todo: { id: string; content: string; status: string; priority: string }, index: number) => {
                const isChecked = todo.status === 'completed' || todo.status === 'cancelled';
                const isFirstInProgress = index === firstInProgressIndex;
                
                return (
                  <div key={todo.id} className="flex items-start gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 cursor-default"
                    />
                    <span className={cn(
                      "flex-1 text-foreground",
                      isChecked && "line-through text-muted-foreground",
                      isFirstInProgress && "font-bold"
                    )}>
                      {todo.content}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      } catch {
        // If parsing fails, fall through to default rendering
      }
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
