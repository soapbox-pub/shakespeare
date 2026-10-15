import z from 'zod';
import { filteredArray } from '@/lib/schema';
import { AI_PROVIDER_PRESETS } from '@/lib/aiProviderPresets';
import { DEFAULT_DEPLOY_PROVIDERS, migrateDeployProvider } from '@/lib/deployProviderPresets';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { REASONING_EFFORTS, type AISettings, type MCPServer } from '@/contexts/AISettingsContext';
import type { GitSettings, GitCredential } from '@/contexts/GitSettingsContext';
import type { DeployProvider, DeploySettings } from '@/contexts/DeploySettingsContext';

/**
 * Get AI config file path
 * @param configPath - Custom config path (default: /config)
 */
function getAIConfigPath(configPath = '/config'): string {
  return `${configPath}/ai.json`;
}

/**
 * Get Git config file path
 * @param configPath - Custom config path (default: /config)
 */
function getGitConfigPath(configPath = '/config'): string {
  return `${configPath}/git.json`;
}

/**
 * Get Deploy config file path
 * @param configPath - Custom config path (default: /config)
 */
function getDeployConfigPath(configPath = '/config'): string {
  return `${configPath}/deploy.json`;
}

const aiProviderSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  baseURL: z.string().url(),
  apiKey: z.string().optional(),
  nostr: z.boolean().optional(),
  proxy: z.boolean().optional(),
  openSecret: z.string().url().optional(),
});

const providerModelSchema = z.string().regex(
  /^[^/]+\/.+$/,
  'Must be in format provider/model (e.g., "openai/gpt-4o")',
);

const mcpServerSchema: z.ZodType<MCPServer> = z.object({
  type: z.literal('streamable-http'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const aiSettingsSchema = z.object({
  providers: filteredArray(aiProviderSchema),
  recentlyUsedModels: filteredArray(providerModelSchema),
  imageModel: providerModelSchema.optional(),
  mcpServers: z.record(z.string(), mcpServerSchema).optional(),
  reasoningEffort: z.enum([...REASONING_EFFORTS, 'default']).optional().catch(undefined),
});

// New format for git credentials
const gitCredentialSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: z.string(),
  username: z.string(),
  password: z.string(),
});

// Old format (map of origins to credentials)
const gitCredentialOldSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// Schema that accepts both old and new formats
const gitSettingsSchema = z.object({
  credentials: z.union([
    z.array(gitCredentialSchema), // New format: array
    z.record(z.string(), gitCredentialOldSchema), // Old format: map
  ]),
  name: z.string().optional(),
  email: z.string().optional(),
  coAuthorEnabled: z.boolean().optional(),
});

const baseDeployProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  proxy: z.boolean().optional(),
});

const npanelProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('npanel'),
  dashboardHost: z.string(),
  domain: z.string(),
  relayUrls: z.array(z.string()),
  blossomServers: z.array(z.string()),
});

const netlifyProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('netlify'),
  apiKey: z.string(),
  baseURL: z.string().optional(),
});

const vercelProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('vercel'),
  apiKey: z.string(),
  baseURL: z.string().optional(),
});

const nsiteProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('nsite'),
  gateway: z.string(),
  relayUrls: z.array(z.string()),
  blossomServers: z.array(z.string()),
});

const cloudflareProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('cloudflare'),
  apiKey: z.string(),
  accountId: z.string(),
  baseURL: z.string().optional(),
  baseDomain: z.string().optional(),
});

const denoDeployProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('deno'),
  apiKey: z.string(),
  organizationId: z.string(),
  baseURL: z.string().optional(),
  baseDomain: z.string().optional(),
});

const railwayProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('railway'),
  apiKey: z.string(),
  baseURL: z.string().optional(),
});

const deployProviderSchema: z.ZodType<DeployProvider> = z.discriminatedUnion('type', [
  npanelProviderSchema,
  netlifyProviderSchema,
  vercelProviderSchema,
  nsiteProviderSchema,
  cloudflareProviderSchema,
  denoDeployProviderSchema,
  railwayProviderSchema,
]);

const deploySettingsSchema = z.object({
  providers: filteredArray(deployProviderSchema),
});

/**
 * Ensures the config directory exists
 * @param fs - Filesystem instance
 * @param configPath - Custom config path (default: /config)
 */
async function ensureConfigDir(fs: JSRuntimeFS, configPath = '/config'): Promise<void> {
  try {
    await fs.stat(configPath);
  } catch {
    await fs.mkdir(configPath, { recursive: true });
  }
}

/**
 * Read AI settings from VFS
 * @param fs - Filesystem instance
 * @param configPath - Custom config path (default: /config)
 */
export async function readAISettings(fs: JSRuntimeFS, configPath = '/config'): Promise<AISettings> {
  const defaultSettings: AISettings = {
    providers: [],
    recentlyUsedModels: [],
    mcpServers: {},
  };

  try {
    const aiConfigPath = getAIConfigPath(configPath);
    const content = await fs.readFile(aiConfigPath, 'utf8');
    const data = JSON.parse(content);
    const parsed = aiSettingsSchema.parse(data);

    return {
      ...parsed,
      providers: parsed.providers.map((provider) => {
        let name = provider.name;

        // Fill in name from presets if missing
        if (typeof name !== 'string') {
          const presetProvider = AI_PROVIDER_PRESETS.find(preset => preset.id === provider.id);
          if (presetProvider) {
            name = presetProvider.name;
          }
        }

        // Fallback to id if name is still missing
        if (typeof name !== 'string') {
          name = provider.id;
        }

        return {
          ...provider,
          name,
        }
      }),
      mcpServers: parsed.mcpServers || {},
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('AI settings parsing error:', error.issues);
    }
    return defaultSettings;
  }
}

/**
 * Write AI settings to VFS
 * @param fs - Filesystem instance
 * @param settings - AI settings to write
 * @param configPath - Custom config path (default: /config)
 */
export async function writeAISettings(fs: JSRuntimeFS, settings: AISettings, configPath = '/config'): Promise<void> {
  await ensureConfigDir(fs, configPath);
  const aiConfigPath = getAIConfigPath(configPath);
  await fs.writeFile(aiConfigPath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Generate a display name for a credential based on its hostname
 */
function generateCredentialName(host: string): string {
  const hostname = host.split(':')[0]; // Remove port if present

  if (hostname === 'github.com') {
    return 'GitHub';
  }

  if (hostname === 'gitlab.com') {
    return 'GitLab';
  }

  // For other hosts, use the hostname as the name
  return hostname;
}

/**
 * Convert old format credentials (map) to new format (array)
 * This is only used for migrating from the old map-based format
 */
function convertCredentialsToNewFormat(
  credentials: Record<string, { username: string; password: string }>
): GitCredential[] {
  return Object.entries(credentials).map(([origin, cred]) => {
    const url = new URL(origin);
    const host = url.host; // Includes port if non-standard

    return {
      id: crypto.randomUUID(),
      name: generateCredentialName(host),
      origin,
      username: cred.username,
      password: cred.password,
    };
  });
}

/**
 * Read Git settings from VFS
 * @param fs - Filesystem instance
 * @param configPath - Custom config path (default: /config)
 */
export async function readGitSettings(fs: JSRuntimeFS, configPath = '/config'): Promise<GitSettings> {
  const defaultSettings: GitSettings = {
    credentials: [],
    coAuthorEnabled: true,
  };

  // Try to read from VFS first
  try {
    const gitConfigPath = getGitConfigPath(configPath);
    const content = await fs.readFile(gitConfigPath, 'utf8');
    const data = JSON.parse(content);
    const parsed = gitSettingsSchema.parse(data);

    // Convert old format to new format if needed
    let credentials: GitCredential[];
    if (Array.isArray(parsed.credentials)) {
      credentials = parsed.credentials;
    } else {
      credentials = convertCredentialsToNewFormat(parsed.credentials);
    }

    return {
      ...parsed,
      credentials,
    };
  } catch {
    return defaultSettings;
  }
}

/**
 * Write Git settings to VFS
 * @param fs - Filesystem instance
 * @param settings - Git settings to write
 * @param configPath - Custom config path (default: /config)
 */
export async function writeGitSettings(fs: JSRuntimeFS, settings: GitSettings, configPath = '/config'): Promise<void> {
  await ensureConfigDir(fs, configPath);
  const gitConfigPath = getGitConfigPath(configPath);
  await fs.writeFile(gitConfigPath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Read Deploy settings from VFS
 *
 * A user with no settings file is not the same as a user who removed every
 * provider, and the difference is what a new user sees the first time they open
 * the deploy button: the default gateway, or an empty screen asking them to
 * choose a host. Both used to answer "no providers", so the default had never
 * actually reached anybody — it was written, saved back as an empty list on the
 * next render, and gone.
 *
 * @param fs - Filesystem instance
 * @param configPath - Custom config path (default: /config)
 */
export async function readDeploySettings(fs: JSRuntimeFS, configPath = '/config'): Promise<DeploySettings> {
  const deployConfigPath = getDeployConfigPath(configPath);

  let content: string;
  try {
    content = await fs.readFile(deployConfigPath, 'utf8');
  } catch {
    // A copy, so the caller editing its providers can't reach back into the
    // module-level defaults every other caller will be handed.
    return { providers: [...DEFAULT_DEPLOY_PROVIDERS] };
  }

  try {
    const data = JSON.parse(content) as { providers?: unknown };
    const migrated = {
      ...data,
      providers: Array.isArray(data?.providers) ? data.providers.map(migrateDeployProvider) : data?.providers,
    };
    return deploySettingsSchema.parse(migrated);
  } catch (error) {
    // A file that exists and cannot be read is a different problem from one that
    // isn't there: handing back the defaults would silently replace whatever the
    // user had, so this keeps nothing rather than inventing something.
    if (error instanceof z.ZodError) {
      console.error('Deploy settings parsing error:', error.issues);
    }
    return { providers: [] };
  }
}

/**
 * Write Deploy settings to VFS
 * @param fs - Filesystem instance
 * @param settings - Deploy settings to write
 * @param configPath - Custom config path (default: /config)
 */
export async function writeDeploySettings(fs: JSRuntimeFS, settings: DeploySettings, configPath = '/config'): Promise<void> {
  await ensureConfigDir(fs, configPath);
  const deployConfigPath = getDeployConfigPath(configPath);
  await fs.writeFile(deployConfigPath, JSON.stringify(settings, null, 2), 'utf8');
}

