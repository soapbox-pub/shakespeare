import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ModelSelector } from './ModelSelector';

// Mock the hooks
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: vi.fn(),
}));

vi.mock('@/hooks/useProviderModels', () => ({
  useProviderModels: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';

const mockUseAISettings = vi.mocked(useAISettings);
const mockUseProviderModels = vi.mocked(useProviderModels);

describe('ModelSelector', () => {
  const mockOnChange = vi.fn();
  const mockAddRecentlyUsedModel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels: [] },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      addProvider: vi.fn(),
      updateProvider: vi.fn(),
    });

    mockUseProviderModels.mockReturnValue({
      models: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('hides recently used section when less than 5 models and all recently used are available', async () => {
    // Setup: 3 available models, 2 recently used models that are both available
    const availableModels = [
      { fullId: 'provider1/model1', provider: 'provider1', id: 'model1' },
      { fullId: 'provider1/model2', provider: 'provider1', id: 'model2' },
      { fullId: 'provider2/model3', provider: 'provider2', id: 'model3' },
    ];

    const recentlyUsedModels = ['provider1/model1', 'provider1/model2'];

    mockUseProviderModels.mockReturnValue({
      models: availableModels,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      addProvider: vi.fn(),
      updateProvider: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="" onChange={mockOnChange} />
      </TestApp>
    );

    // Open the dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Wait for the dropdown to open
    await waitFor(() => {
      expect(screen.getByText('provider1')).toBeInTheDocument();
    });

    // Recently used section should NOT be visible
    expect(screen.queryByText('Recently Used')).not.toBeInTheDocument();
  });

  it('shows recently used section when less than 5 models but some recently used are not available', async () => {
    // Setup: 3 available models, 2 recently used models where 1 is not available
    const availableModels = [
      { fullId: 'provider1/model1', provider: 'provider1', id: 'model1' },
      { fullId: 'provider1/model2', provider: 'provider1', id: 'model2' },
      { fullId: 'provider2/model3', provider: 'provider2', id: 'model3' },
    ];

    const recentlyUsedModels = ['provider1/model1', 'provider3/model4']; // model4 not in available

    mockUseProviderModels.mockReturnValue({
      models: availableModels,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      addProvider: vi.fn(),
      updateProvider: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="" onChange={mockOnChange} />
      </TestApp>
    );

    // Open the dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Wait for the dropdown to open
    await waitFor(() => {
      expect(screen.getByText('provider1')).toBeInTheDocument();
    });

    // Recently used section SHOULD be visible
    expect(screen.getByText('Recently Used')).toBeInTheDocument();
  });

  it('shows recently used section when 5 or more models are available', async () => {
    // Setup: 5 available models, 2 recently used models that are both available
    const availableModels = [
      { fullId: 'provider1/model1', provider: 'provider1', id: 'model1' },
      { fullId: 'provider1/model2', provider: 'provider1', id: 'model2' },
      { fullId: 'provider2/model3', provider: 'provider2', id: 'model3' },
      { fullId: 'provider2/model4', provider: 'provider2', id: 'model4' },
      { fullId: 'provider3/model5', provider: 'provider3', id: 'model5' },
    ];

    const recentlyUsedModels = ['provider1/model1', 'provider1/model2'];

    mockUseProviderModels.mockReturnValue({
      models: availableModels,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      addProvider: vi.fn(),
      updateProvider: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="" onChange={mockOnChange} />
      </TestApp>
    );

    // Open the dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Wait for the dropdown to open
    await waitFor(() => {
      expect(screen.getByText('provider1')).toBeInTheDocument();
    });

    // Recently used section SHOULD be visible
    expect(screen.getByText('Recently Used')).toBeInTheDocument();
  });

  it('hides recently used section when no recently used models exist', async () => {
    const availableModels = [
      { fullId: 'provider1/model1', provider: 'provider1', id: 'model1' },
      { fullId: 'provider1/model2', provider: 'provider1', id: 'model2' },
    ];

    mockUseProviderModels.mockReturnValue({
      models: availableModels,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseAISettings.mockReturnValue({
      settings: { providers: {}, recentlyUsedModels: [] }, // No recently used models
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      addProvider: vi.fn(),
      updateProvider: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="" onChange={mockOnChange} />
      </TestApp>
    );

    // Open the dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Wait for the dropdown to open
    await waitFor(() => {
      expect(screen.getByText('provider1')).toBeInTheDocument();
    });

    // Recently used section should NOT be visible
    expect(screen.queryByText('Recently Used')).not.toBeInTheDocument();
  });
});