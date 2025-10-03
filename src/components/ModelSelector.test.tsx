import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Decimal } from 'decimal.js';
import { TestApp } from '@/test/TestApp';
import { ModelSelector } from './ModelSelector';

// Mock the hooks
vi.mock('@/hooks/useAISettings', () => ({
  useAISettings: vi.fn(),
}));

vi.mock('@/hooks/useProviderModels', () => ({
  useProviderModels: vi.fn(),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(),
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
import { useIsMobile } from '@/hooks/useIsMobile';

const mockUseAISettings = vi.mocked(useAISettings);
const mockUseProviderModels = vi.mocked(useProviderModels);
const mockUseIsMobile = vi.mocked(useIsMobile);

describe('ModelSelector', () => {
  const mockOnChange = vi.fn();
  const mockAddRecentlyUsedModel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAISettings.mockReturnValue({
      settings: { providers: [], recentlyUsedModels: [] },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      setProvider: vi.fn(),
      setProviders: vi.fn(),

    });

    mockUseProviderModels.mockReturnValue({
      models: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseIsMobile.mockReturnValue(false);
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
      settings: { providers: [], recentlyUsedModels },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      setProvider: vi.fn(),
      setProviders: vi.fn(),

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
      settings: { providers: [], recentlyUsedModels },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      setProvider: vi.fn(),
      setProviders: vi.fn(),

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
      settings: { providers: [], recentlyUsedModels },
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      setProvider: vi.fn(),
      setProviders: vi.fn(),

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
      settings: { providers: [], recentlyUsedModels: [] }, // No recently used models
      addRecentlyUsedModel: mockAddRecentlyUsedModel,
      isConfigured: true,
      updateSettings: vi.fn(),
      removeProvider: vi.fn(),
      setProvider: vi.fn(),
      setProviders: vi.fn(),

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

  it('shows caution icon for free models', async () => {
    const freeModel = {
      fullId: 'provider1/free-model',
      provider: 'provider1',
      id: 'free-model',
      pricing: {
        prompt: new Decimal('0'),
        completion: new Decimal('0'),
      },
    };

    const paidModel = {
      fullId: 'provider1/paid-model',
      provider: 'provider1',
      id: 'paid-model',
      pricing: {
        prompt: new Decimal('0.01'),
        completion: new Decimal('0.02'),
      },
    };

    mockUseProviderModels.mockReturnValue({
      models: [freeModel, paidModel],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Test with free model selected
    const { rerender } = render(
      <TestApp>
        <ModelSelector value="provider1/free-model" onChange={mockOnChange} />
      </TestApp>
    );

    // Should show caution icon for free model
    expect(screen.getByTestId('triangle-alert')).toBeInTheDocument();

    // Test with paid model selected
    rerender(
      <TestApp>
        <ModelSelector value="provider1/paid-model" onChange={mockOnChange} />
      </TestApp>
    );

    // Should not show caution icon for paid model
    expect(screen.queryByTestId('triangle-alert')).not.toBeInTheDocument();
  });

  it('does not show caution icon when no model is selected', () => {
    const freeModel = {
      fullId: 'provider1/free-model',
      provider: 'provider1',
      id: 'free-model',
      pricing: {
        prompt: new Decimal('0'),
        completion: new Decimal('0'),
      },
    };

    mockUseProviderModels.mockReturnValue({
      models: [freeModel],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="" onChange={mockOnChange} />
      </TestApp>
    );

    // Should not show caution icon when no model is selected
    expect(screen.queryByTestId('triangle-alert')).not.toBeInTheDocument();
  });

  it('does not show caution icon for models without pricing information', () => {
    const modelWithoutPricing = {
      fullId: 'provider1/unknown-pricing',
      provider: 'provider1',
      id: 'unknown-pricing',
      // No pricing property
    };

    mockUseProviderModels.mockReturnValue({
      models: [modelWithoutPricing],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="provider1/unknown-pricing" onChange={mockOnChange} />
      </TestApp>
    );

    // Should not show caution icon for models without pricing info
    expect(screen.queryByTestId('triangle-alert')).not.toBeInTheDocument();
  });

  it('shows tooltip when hovering over caution icon', async () => {
    const user = userEvent.setup();

    const freeModel = {
      fullId: 'provider1/free-model',
      provider: 'provider1',
      id: 'free-model',
      pricing: {
        prompt: new Decimal('0'),
        completion: new Decimal('0'),
      },
    };

    mockUseProviderModels.mockReturnValue({
      models: [freeModel],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="provider1/free-model" onChange={mockOnChange} />
      </TestApp>
    );

    const cautionIcon = screen.getByTestId('triangle-alert');
    expect(cautionIcon).toBeInTheDocument();

    // Hover over the caution icon
    await user.hover(cautionIcon);

    // Wait for tooltip to appear
    await waitFor(() => {
      expect(screen.getAllByText('You are using a free model. For better results, switch to a paid model.').length).toBeGreaterThan(0);
    });
  });

  it('makes caution icon tappable on mobile with click-to-toggle tooltip', async () => {
    const user = userEvent.setup();
    mockUseIsMobile.mockReturnValue(true);

    const freeModel = {
      fullId: 'provider1/free-model',
      provider: 'provider1',
      id: 'free-model',
      pricing: {
        prompt: new Decimal('0'),
        completion: new Decimal('0'),
      },
    };

    mockUseProviderModels.mockReturnValue({
      models: [freeModel],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="provider1/free-model" onChange={mockOnChange} />
      </TestApp>
    );

    const cautionButton = screen.getByRole('button', { name: 'Free model warning' });
    expect(cautionButton).toBeInTheDocument();
    expect(cautionButton).toHaveAttribute('tabIndex', '0'); // Should be tappable on mobile

    // Click to open tooltip - just verify the click works without errors
    await user.click(cautionButton);

    // Tooltip should appear
    await waitFor(() => {
      expect(screen.getAllByText('You are using a free model. For better results, switch to a paid model.').length).toBeGreaterThan(0);
    });

    // The button should still be clickable (no errors)
    await user.click(cautionButton);
    expect(cautionButton).toBeInTheDocument();
  });

  it('makes caution icon not focusable on desktop', () => {
    mockUseIsMobile.mockReturnValue(false);

    const freeModel = {
      fullId: 'provider1/free-model',
      provider: 'provider1',
      id: 'free-model',
      pricing: {
        prompt: new Decimal('0'),
        completion: new Decimal('0'),
      },
    };

    mockUseProviderModels.mockReturnValue({
      models: [freeModel],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TestApp>
        <ModelSelector value="provider1/free-model" onChange={mockOnChange} />
      </TestApp>
    );

    const cautionButton = screen.getByRole('button', { name: 'Free model warning' });
    expect(cautionButton).toBeInTheDocument();
    expect(cautionButton).toHaveAttribute('tabIndex', '-1'); // Should not be focusable on desktop
  });
});