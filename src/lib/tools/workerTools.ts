import type { NostrSigner } from '@nostrify/nostrify';
import type { NUser } from '@nostrify/react/login';

import type { AIProvider, AISettings } from '@/contexts/AISettingsContext';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { Git } from '@/lib/git';
import type { Skill } from '@/lib/skills';
import { parseProviderModel } from '@/lib/parseProviderModel';

import type { Tool } from './Tool';
import { ReadTool } from './ReadTool';
import { WriteTool } from './WriteTool';
import { EditTool } from './EditTool';
import { GlobTool } from './GlobTool';
import { GrepTool } from './GrepTool';
import { GitCommitTool } from './GitCommitTool';
import { NpmAddPackageTool } from './NpmAddPackageTool';
import { NpmRemovePackageTool } from './NpmRemovePackageTool';
import { NostrReadNipTool } from './NostrReadNipTool';
import { NostrFetchEventTool } from './NostrFetchEventTool';
import { NostrReadKindTool } from './NostrReadKindTool';
import { NostrReadTagTool } from './NostrReadTagTool';
import { NostrReadProtocolTool } from './NostrReadProtocolTool';
import { NostrReadNipsIndexTool } from './NostrReadNipsIndexTool';
import { NostrGenerateKindTool } from './NostrGenerateKindTool';
import { NostrPublishEventsTool } from './NostrPublishEventsTool';
import { NostrEncodeTool } from './NostrEncodeTool';
import { NostrDecodeTool } from './NostrDecodeTool';
import { BlossomUploadTool } from './BlossomUploadTool';
import { ShellTool } from './ShellTool';
import { SkillTool } from './SkillTool';
import { WebSearchTool } from './WebSearchTool';
import { TodoWriteTool } from './TodoWriteTool';
import { TodoReadTool } from './TodoReadTool';
import { AppTool } from './AppTool';
import { GenerateImageTool, type ImageGenerationMode } from './GenerateImageTool';
import { EditImageTool } from './EditImageTool';
import { BuildProjectTool } from './BuildProjectTool';

/**
 * The order the built-in tools are offered to the model in. It has to stay the
 * same from turn to turn for the provider's prompt cache, wherever the tools run.
 */
export const BUILT_IN_TOOL_ORDER = [
  'read', 'write', 'edit', 'glob', 'grep',
  'git_commit', 'npm_add_package', 'npm_remove_package', 'build_project',
  'nostr_read_nip', 'nostr_fetch_event', 'nostr_read_kind', 'nostr_read_tag', 'nostr_read_protocol',
  'nostr_read_nips_index', 'nostr_generate_kind', 'nostr_publish_events', 'nostr_encode', 'nostr_decode',
  'blossom_upload', 'shell', 'read_console_messages', 'preview', 'skill', 'webfetch', 'websearch',
  'todowrite', 'todoread', 'app',
  'generate_image', 'edit_image', 'view_available_models', 'configure_image_generation',
];

/** Put tools in `BUILT_IN_TOOL_ORDER`, followed by any others in the order given. */
export function inToolOrder<T>(tools: Record<string, T>): Record<string, T> {
  const ordered: Record<string, T> = {};
  for (const name of BUILT_IN_TOOL_ORDER) {
    if (name in tools) ordered[name] = tools[name];
  }
  return { ...ordered, ...tools };
}

/** The image model the generate_image and edit_image tools use. */
export interface ImageGeneration {
  provider: AIProvider;
  model: string;
  mode: ImageGenerationMode;
}

/** The image model configured in the AI settings, if there is one. */
export function resolveImageGeneration(
  settings: Pick<AISettings, 'imageModel' | 'providers'>,
  models: Array<{ fullId: string; type?: 'chat' | 'image'; modalities?: string[] }>,
): ImageGeneration | undefined {
  if (!settings.imageModel) return undefined;
  try {
    const { provider, model } = parseProviderModel(settings.imageModel, settings.providers);
    const providerModel = models.find((m) => m.fullId === settings.imageModel);

    // 'chat' if the model outputs images from a chat completion, otherwise the images API
    let mode: ImageGenerationMode = 'image';
    if (providerModel?.type) {
      mode = providerModel.type;
    } else if (providerModel?.modalities?.includes('image')) {
      mode = 'chat';
    }

    return { provider, model, mode };
  } catch (error) {
    console.warn('Failed to parse imageModel:', error);
    return undefined;
  }
}

export interface WorkerToolsEnv {
  fs: JSRuntimeFS;
  git: Git;
  projectId: string;
  /** The project's directory */
  cwd: string;
  projectsPath: string;
  tmpPath: string;
  corsProxy: string;
  /** ESM CDN for builds */
  esmUrl: string;
  /** Relays the user writes to */
  writeRelays: string[];
  user?: NUser;
  signer?: NostrSigner;
  skills: Skill[];
  imageGeneration?: ImageGeneration;
  onFileChanged?: (filePath: string) => void;
  onCommit?: () => void;
  onBuilt?: () => void;
}

/**
 * The built-in tools that need no page: no DOM, no Web Workers, nothing only a
 * window has. They run wherever the assistant does, in the page or in the
 * service worker. The rest (the preview, its console, web pages,
 * settings, MCP) are the page's.
 */
export function createWorkerTools(env: WorkerToolsEnv): Record<string, Tool<unknown>> {
  const { fs, git, projectId, cwd, projectsPath, tmpPath, corsProxy, user, signer, onFileChanged, onCommit } = env;

  const tools: Record<string, Tool<unknown>> = {
    read: new ReadTool(fs, cwd, { projectsPath }),
    write: new WriteTool(fs, cwd, { projectsPath, tmpPath, onFileChanged }),
    edit: new EditTool(fs, cwd, { projectsPath, tmpPath, onFileChanged }),
    glob: new GlobTool(fs, cwd),
    grep: new GrepTool(fs, cwd),
    git_commit: new GitCommitTool(fs, cwd, git, { onCommit }),
    npm_add_package: new NpmAddPackageTool(fs, cwd),
    npm_remove_package: new NpmRemovePackageTool(fs, cwd),
    build_project: new BuildProjectTool(fs, cwd, env.esmUrl, { onBuilt: env.onBuilt }),
    nostr_read_nip: new NostrReadNipTool(),
    nostr_fetch_event: new NostrFetchEventTool(),
    nostr_read_kind: new NostrReadKindTool(),
    nostr_read_tag: new NostrReadTagTool(),
    nostr_read_protocol: new NostrReadProtocolTool(),
    nostr_read_nips_index: new NostrReadNipsIndexTool(),
    nostr_generate_kind: new NostrGenerateKindTool(),
    nostr_publish_events: new NostrPublishEventsTool(),
    nostr_encode: new NostrEncodeTool(),
    nostr_decode: new NostrDecodeTool(),
    blossom_upload: new BlossomUploadTool(fs, cwd, signer),
    shell: new ShellTool(fs, cwd, git, corsProxy, signer),
    skill: new SkillTool(fs, env.skills),
    websearch: new WebSearchTool(),
    todowrite: new TodoWriteTool(fs, projectId, { projectsPath }),
    todoread: new TodoReadTool(fs, projectId, { projectsPath }),
    app: new AppTool(fs, cwd, signer, user?.pubkey, env.writeRelays),
  };

  if (env.imageGeneration) {
    const { provider, model, mode } = env.imageGeneration;
    const generateImage = new GenerateImageTool(fs, tmpPath, provider, model, mode, user, corsProxy);
    tools.generate_image = generateImage;
    tools.edit_image = new EditImageTool(fs, cwd, generateImage);
  }

  return tools;
}
