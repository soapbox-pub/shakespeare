import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ModelInput } from './ModelInput';

// Mock the hooks
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: () => ({
    settings: {
      providers: [
        { id: 'test-provider', name: 'Test Provider', baseURL: 'https://api.test.com' }
      ]
    }
  })
}));

vi.mock('@/hooks/useProviderModels', () => ({
  useProviderModels: () => ({
    models: [
      {
        id: 'text-model',
        name: 'Text Model',
        provider: 'test-provider',
        fullId: 'test-provider/text-model',
        inputModalities: ['text'],
        outputModalities: ['text']
      },
      {
        id: 'image-model',
        name: 'Image Model',
        provider: 'test-provider',
        fullId: 'test-provider/image-model',
        inputModalities: ['text'],
        outputModalities: ['image']
      },
      {
        id: 'multimodal-model',
        name: 'Multimodal Model',
        provider: 'test-provider',
        fullId: 'test-provider/multimodal-model',
        inputModalities: ['text', 'image'],
        outputModalities: ['text', 'image']
      },
      {
        id: 'no-modalities-model',
        name: 'No Modalities Model',
        provider: 'test-provider',
        fullId: 'test-provider/no-modalities-model'
      }
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn()
  })
}));

describe('ModelInput', () => {
  it('renders without crashing', () => {
    const onChange = vi.fn();
    render(
      <TestApp>
        <ModelInput value="" onChange={onChange} />
      </TestApp>
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('accepts inputModalities and outputModalities props', () => {
    const onChange = vi.fn();
    render(
      <TestApp>
        <ModelInput
          value=""
          onChange={onChange}
          modalities={['image']}
        />
      </TestApp>
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
