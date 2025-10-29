import { describe, it, expect } from 'vitest';
import { AI_PROVIDER_PRESETS, getPresetProvider, getShakespeareProvider } from './aiProviderPresets';

describe('AI Provider Presets', () => {
  it('should export preset providers array', () => {
    expect(AI_PROVIDER_PRESETS).toBeDefined();
    expect(Array.isArray(AI_PROVIDER_PRESETS)).toBe(true);
    expect(AI_PROVIDER_PRESETS.length).toBeGreaterThan(0);
  });

  it('should include Shakespeare provider', () => {
    const shakespeare = AI_PROVIDER_PRESETS.find(p => p.id === 'shakespeare');
    expect(shakespeare).toBeDefined();
    expect(shakespeare?.name).toBe('Shakespeare AI');
    expect(shakespeare?.nostr).toBe(true);
  });

  it('should include other major providers', () => {
    const providerIds = AI_PROVIDER_PRESETS.map(p => p.id);
    expect(providerIds).toContain('openai');
    expect(providerIds).toContain('openrouter');
  });

  it('should get preset provider by id', () => {
    const openai = getPresetProvider('openai');
    expect(openai).toBeDefined();
    expect(openai?.name).toBe('OpenAI');
    
    const nonExistent = getPresetProvider('non-existent');
    expect(nonExistent).toBeUndefined();
  });

  it('should get Shakespeare provider', () => {
    const shakespeare = getShakespeareProvider();
    expect(shakespeare).toBeDefined();
    expect(shakespeare.id).toBe('shakespeare');
    expect(shakespeare.name).toBe('Shakespeare AI');
    expect(shakespeare.nostr).toBe(true);
  });

  it('should have valid preset structure', () => {
    AI_PROVIDER_PRESETS.forEach(preset => {
      expect(preset.id).toBeDefined();
      expect(typeof preset.id).toBe('string');
      expect(preset.name).toBeDefined();
      expect(typeof preset.name).toBe('string');
      expect(preset.baseURL).toBeDefined();
      expect(typeof preset.baseURL).toBe('string');
      expect(preset.baseURL).toMatch(/^https?:\/\//);
      
      // Optional fields
      if (preset.apiKeysURL) {
        expect(typeof preset.apiKeysURL).toBe('string');
        expect(preset.apiKeysURL).toMatch(/^https?:\/\//);
      }
      if (preset.nostr !== undefined) {
        expect(typeof preset.nostr).toBe('boolean');
      }
    });
  });
});