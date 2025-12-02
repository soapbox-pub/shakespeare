import { describe, it, expect } from 'vitest';
import { parseProviderModel } from './parseProviderModel';
import type { AIProvider } from '@/contexts/AISettingsContext';

describe('parseProviderModel', () => {
  const mockProviders: AIProvider[] = [
    {
      id: 'openai',
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-test-key',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      baseURL: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test-key',
    },
    {
      id: 'unconfigured',
      name: 'Unconfigured',
      baseURL: 'https://example.com/v1',
      apiKey: '',
    },
  ];

  it('should parse simple provider/model format', () => {
    const result = parseProviderModel('openai/gpt-4o', mockProviders);

    expect(result.model).toBe('gpt-4o');
    expect(result.provider).toEqual({
      id: 'openai',
      name: mockProviders[0].name,
      baseURL: mockProviders[0].baseURL,
      apiKey: mockProviders[0].apiKey,
      nostr: mockProviders[0].nostr,
    });
  });

  it('should parse complex model names with slashes', () => {
    const result = parseProviderModel('openrouter/anthropic/claude-sonnet-4', mockProviders);

    expect(result.model).toBe('anthropic/claude-sonnet-4');
    expect(result.provider).toEqual({
      id: 'openrouter',
      name: mockProviders[1].name,
      baseURL: mockProviders[1].baseURL,
      apiKey: mockProviders[1].apiKey,
      nostr: mockProviders[1].nostr,
    });
  });

  it('should handle model names with multiple slashes', () => {
    const result = parseProviderModel('openrouter/meta/llama-3.1-405b-instruct', mockProviders);

    expect(result.model).toBe('meta/llama-3.1-405b-instruct');
    expect(result.provider).toEqual({
      id: 'openrouter',
      name: mockProviders[1].name,
      baseURL: mockProviders[1].baseURL,
      apiKey: mockProviders[1].apiKey,
      nostr: mockProviders[1].nostr,
    });
  });

  it('should throw error for invalid format without slash', () => {
    expect(() => {
      parseProviderModel('invalidformat', mockProviders);
    }).toThrow('Invalid format. Use provider/model (e.g., "openai/gpt-4o")');
  });

  it('should throw error for empty provider', () => {
    expect(() => {
      parseProviderModel('/gpt-4o', mockProviders);
    }).toThrow('Invalid format. Both provider and model must be specified');
  });

  it('should throw error for empty model', () => {
    expect(() => {
      parseProviderModel('openai/', mockProviders);
    }).toThrow('Invalid format. Both provider and model must be specified');
  });

  it('should throw error for unknown provider', () => {
    expect(() => {
      parseProviderModel('unknown/gpt-4o', mockProviders);
    }).toThrow('Provider "unknown" not found. Available providers: openai, openrouter, anthropic, unconfigured');
  });


});