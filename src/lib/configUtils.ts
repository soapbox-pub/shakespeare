import z from 'zod';
import { filteredArray } from '@/lib/schema';
import { AI_PROVIDER_PRESETS } from '@/lib/aiProviderPresets';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { AISettings, MCPServer } from '@/contexts/AISettingsContext';
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
});

// New format for git credentials
const gitCredentialSchema = z.object({
  protocol: z.string(),
  host: z.string(),
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

const shakespeareDeployProviderSchema = baseDeployProviderSchema.extend({
  type: z.literal('shakespeare'),
  host: z.string().optional(),
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

const deployProviderSchema: z.ZodType<DeployProvider> = z.discriminatedUnion('type', [
  shakespeareDeployProviderSchema,
  netlifyProviderSchema,
  vercelProviderSchema,
  nsiteProviderSchema,
  cloudflareProviderSchema,
  denoDeployProviderSchema,
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
      console.error('AI settings parsing error:', error.errors);
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
 * Convert old format credentials (map) to new format (array)
 */
function convertCredentialsToNewFormat(
  credentials: Record<string, { username: string; password: string }>
): GitCredential[] {
  return Object.entries(credentials).map(([origin, cred]) => {
    const url = new URL(origin);
    return {
      protocol: url.protocol.replace(/:$/, ''),
      host: url.host, // Includes port if non-standard
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
 * @param fs - Filesystem instance
 * @param configPath - Custom config path (default: /config)
 */
export async function readDeploySettings(fs: JSRuntimeFS, configPath = '/config'): Promise<DeploySettings> {
  const defaultSettings: DeploySettings = {
    providers: [],
  };

  try {
    const deployConfigPath = getDeployConfigPath(configPath);
    const content = await fs.readFile(deployConfigPath, 'utf8');
    const data = JSON.parse(content);
    return deploySettingsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Deploy settings parsing error:', error.errors);
    }
    return defaultSettings;
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

