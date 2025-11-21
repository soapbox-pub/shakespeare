import z from 'zod';
import { filteredArray } from '@/lib/schema';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { AIProvider, AISettings, MCPServer } from '@/contexts/AISettingsContext';
import type { GitSettings } from '@/contexts/GitSettingsContext';
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

const aiProviderSchema: z.ZodType<AIProvider> = z.object({
  id: z.string(),
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
});

const aiSettingsSchema = z.object({
  providers: filteredArray(aiProviderSchema),
  recentlyUsedModels: filteredArray(providerModelSchema),
  mcpServers: z.record(z.string(), mcpServerSchema).optional(),
});

const gitCredentialSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const gitHostTokenSchema = z.object({
  token: z.string(),
  username: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  createdAt: z.number().optional(),
});

const gitSettingsSchema = z.object({
  credentials: z.record(z.string(), gitCredentialSchema),
  hostTokens: z.record(z.string(), gitHostTokenSchema).optional(),
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

const deployProviderSchema: z.ZodType<DeployProvider> = z.discriminatedUnion('type', [
  shakespeareDeployProviderSchema,
  netlifyProviderSchema,
  vercelProviderSchema,
  nsiteProviderSchema,
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
    // Ensure mcpServers exists even if not in parsed data
    return {
      ...parsed,
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
 * Read Git settings from VFS
 * @param fs - Filesystem instance
 * @param configPath - Custom config path (default: /config)
 */
export async function readGitSettings(fs: JSRuntimeFS, configPath = '/config'): Promise<GitSettings> {
  const defaultSettings: GitSettings = {
    credentials: {},
    hostTokens: {},
    coAuthorEnabled: true,
  };

  // Try to read from VFS first
  try {
    const gitConfigPath = getGitConfigPath(configPath);
    const content = await fs.readFile(gitConfigPath, 'utf8');
    const data = JSON.parse(content);
    const parsed = gitSettingsSchema.parse(data);
    // Ensure hostTokens exists even if not in parsed data
    return {
      ...parsed,
      hostTokens: parsed.hostTokens || {},
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

