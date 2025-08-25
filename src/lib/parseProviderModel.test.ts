import { describe, it, expect } from 'vitest';
import { parseProviderModel } from './parseProviderModel';
import type { AIConnection } from '@/contexts/AISettingsContext';

describe('parseProviderModel', () => {
  const mockProviders: Record<string, AIConnection> = {
    openai: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
    },
    openrouter: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-or-test-key',
    },
    anthropic: {
      baseURL: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test-key',
    },
    unconfigured: {
      baseURL: 'https://example.com/v1',
      apiKey: '',
    },
  };

  it('should parse simple provider/model format', () => {
    const result = parseProviderModel('openai/gpt-4o', mockProviders);
    
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o');
    expect(result.connection).toEqual(mockProviders.openai);
  });

  it('should parse complex model names with slashes', () => {
    const result = parseProviderModel('openrouter/anthropic/claude-sonnet-4', mockProviders);
    
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('anthropic/claude-sonnet-4');
    expect(result.connection).toEqual(mockProviders.openrouter);
  });

  it('should handle model names with multiple slashes', () => {
    const result = parseProviderModel('openrouter/meta/llama-3.1-405b-instruct', mockProviders);
    
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe('meta/llama-3.1-405b-instruct');
    expect(result.connection).toEqual(mockProviders.openrouter);
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

  it('should throw error for provider without API key', () => {
    expect(() => {
      parseProviderModel('unconfigured/some-model', mockProviders);
    }).toThrow('Provider "unconfigured" is not configured with an API key');
  });
});