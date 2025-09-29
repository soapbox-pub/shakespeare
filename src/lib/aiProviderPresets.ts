export interface PresetProvider {
  id: string;
  name: string;
  baseURL: string;
  apiKeysURL?: string;
  nostr?: boolean;
}

export const AI_PROVIDER_PRESETS: PresetProvider[] = [
  {
    id: "shakespeare",
    name: "Shakespeare AI",
    baseURL: "https://ai.shakespeare.diy/v1",
    nostr: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKeysURL: "https://openrouter.ai/settings/keys",
  },
  {
    id: "ppq",
    name: "PayPerQ",
    baseURL: "https://api.ppq.ai",
    apiKeysURL: "https://ppq.ai/api-docs",
  },
  {
    id: "routstr",
    name: "Routstr",
    baseURL: "https://api.routstr.com/v1",
    apiKeysURL: "https://chat.routstr.com/",
  },
  {
    id: "zai",
    name: "Z.ai",
    baseURL: "https://api.z.ai/api/paas/v4",
    apiKeysURL: "https://z.ai/manage-apikey/apikey-list",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKeysURL: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    apiKeysURL: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "xai",
    name: "xAI",
    baseURL: "https://api.x.ai/v1",
    apiKeysURL: "https://console.x.ai",
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