export interface PresetProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKeysURL?: string;
  nostr?: boolean;
  tosURL?: string;
  proxy?: boolean;
}

export const AI_PROVIDER_PRESETS: PresetProvider[] = [
  {
    id: "shakespeare",
    name: "Shakespeare AI",
    baseURL: "https://ai.shakespeare.diy/v1",
    tosURL: "https://ai.shakespeare.diy/terms",
    nostr: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeysURL: "https://openrouter.ai/settings/keys",
    tosURL: "https://openrouter.ai/terms",
  },
  {
    id: "ppq",
    name: "PayPerQ",
    baseURL: "https://api.ppq.ai",
    apiKeysURL: "https://ppq.ai/api-docs",
    tosURL: "https://ppq.ai/terms",
  },
  {
    id: "routstr",
    name: "Routstr",
    baseURL: "https://api.routstr.com/v1",
    apiKeysURL: "https://chat.routstr.com/",
    tosURL: "https://routstr.com/terms",
  },
  {
    id: "zai",
    name: "Z.ai",
    baseURL: "https://api.z.ai/api/paas/v4",
    apiKeysURL: "https://z.ai/manage-apikey/apikey-list",
    tosURL: "https://docs.z.ai/legal-agreement/terms-of-use",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKeysURL: "https://platform.openai.com/api-keys",
    tosURL: "https://openai.com/policies/",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    apiKeysURL: "https://console.anthropic.com/settings/keys",
    tosURL: "https://www.anthropic.com/legal/",
  },
  {
    id: "xai",
    name: "xAI",
    baseURL: "https://api.x.ai/v1",
    apiKeysURL: "https://console.x.ai",
    tosURL: "https://x.ai/legal",
  },
  {
    id: "deepseek",
    name: "Deepseek",
    baseURL: "https://api.deepseek.com/v1",
    apiKeysURL: "https://platform.deepseek.com/api_keys",
    tosURL: "https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html",
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    baseURL: "https://api.moonshot.ai/v1",
    apiKeysURL: "https://platform.moonshot.ai/console/api-keys",
    tosURL: "https://platform.moonshot.ai/docs/agreement/modeluse",
    proxy: true,
  },
];

// Helper function to get a specific preset by ID
export function getPresetProvider(id: string): PresetProvider | undefined {
  return AI_PROVIDER_PRESETS.find(preset => preset.id === id);
}

// Helper function to get the Shakespeare provider preset
export function getShakespeareProvider(): PresetProvider {
  const shakespeare = getPresetProvider("shakespeare");
  if (!shakespeare) {
    throw new Error("Shakespeare provider preset not found");
  }
  return shakespeare;
}