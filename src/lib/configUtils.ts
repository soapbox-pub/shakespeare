import z from 'zod';
import { filteredArray } from '@/lib/schema';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import type { AIProvider, AISettings } from '@/contexts/AISettingsContext';
import type { GitSettings } from '@/contexts/GitSettingsContext';

const CONFIG_DIR = '/config';
const AI_CONFIG_PATH = `${CONFIG_DIR}/ai.json`;
const GIT_CONFIG_PATH = `${CONFIG_DIR}/git.json`;

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

const aiSettingsSchema = z.object({
  providers: filteredArray(aiProviderSchema),
  recentlyUsedModels: filteredArray(providerModelSchema),
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

/**
 * Ensures the config directory exists
 */
async function ensureConfigDir(fs: JSRuntimeFS): Promise<void> {
  try {
    await fs.stat(CONFIG_DIR);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read AI settings from VFS
 */
export async function readAISettings(fs: JSRuntimeFS): Promise<AISettings> {
  const defaultSettings: AISettings = {
    providers: [],
    recentlyUsedModels: [],
  };

  try {
    const content = await fs.readFile(AI_CONFIG_PATH, 'utf8');
    const data = JSON.parse(content);
    return aiSettingsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('AI settings parsing error:', error.errors);
    }
    return defaultSettings;
  }
}

/**
 * Write AI settings to VFS
 */
export async function writeAISettings(fs: JSRuntimeFS, settings: AISettings): Promise<void> {
  await ensureConfigDir(fs);
  await fs.writeFile(AI_CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Read Git settings from VFS
 */
export async function readGitSettings(fs: JSRuntimeFS): Promise<GitSettings> {
  const defaultSettings: GitSettings = {
    credentials: {},
    hostTokens: {},
    coAuthorEnabled: true,
  };

  // Try to read from VFS first
  try {
    const content = await fs.readFile(GIT_CONFIG_PATH, 'utf8');
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
 */
export async function writeGitSettings(fs: JSRuntimeFS, settings: GitSettings): Promise<void> {
  await ensureConfigDir(fs);
  await fs.writeFile(GIT_CONFIG_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

