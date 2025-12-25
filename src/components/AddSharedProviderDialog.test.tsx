import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { AddSharedProviderDialog } from './AddSharedProviderDialog';
import type { AIProvider } from '@/contexts/AISettingsContext';

describe('AddSharedProviderDialog', () => {
  const mockProvider: AIProvider = {
    id: 'test-provider',
    name: 'Test Provider',
    baseURL: 'https://api.test.com/v1',
    apiKey: 'sk-test-key-123',
  };

  it('renders new provider dialog', () => {
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <AddSharedProviderDialog
          open={true}
          onOpenChange={onOpenChange}
          provider={mockProvider}
        />
      </TestApp>
    );

    // Provider name is used as the heading (fallback to id since it's not in presets)
    expect(screen.getByRole('heading', { name: 'test-provider' })).toBeInTheDocument();
    expect(screen.getByText(/Add test-provider to your configuration/i)).toBeInTheDocument();
  });

  it('shows add provider button for new provider', () => {
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <AddSharedProviderDialog
          open={true}
          onOpenChange={onOpenChange}
          provider={mockProvider}
        />
      </TestApp>
    );

    // No cancel button, only add provider button
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument();
  });

  it('calls onOpenChange when add provider is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <AddSharedProviderDialog
          open={true}
          onOpenChange={onOpenChange}
          provider={mockProvider}
        />
      </TestApp>
    );

    const addButton = screen.getByRole('button', { name: /add provider/i });
    await user.click(addButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not display provider details for new provider', () => {
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <AddSharedProviderDialog
          open={true}
          onOpenChange={onOpenChange}
          provider={mockProvider}
        />
      </TestApp>
    );

    // Provider details (API key, base URL, etc.) are not displayed for new providers
    expect(screen.queryByText('••••••••')).not.toBeInTheDocument();
    expect(screen.queryByText('sk-test-key-123')).not.toBeInTheDocument();
    expect(screen.queryByText('https://api.test.com/v1')).not.toBeInTheDocument();
  });

  it('displays provider name from presets when available', () => {
    const onOpenChange = vi.fn();
    // Use a provider that exists in presets
    const openrouterProvider: AIProvider = {
      id: 'openrouter',
      name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test-123',
    };

    render(
      <TestApp>
        <AddSharedProviderDialog
          open={true}
          onOpenChange={onOpenChange}
          provider={openrouterProvider}
        />
      </TestApp>
    );

    // Should show the preset name "OpenRouter" instead of the id
    expect(screen.getByText(/Add OpenRouter to your configuration/i)).toBeInTheDocument();
  });

  it('uses provider id as fallback name when not in presets', () => {
    const onOpenChange = vi.fn();
    const customProvider: AIProvider = {
      id: 'my-custom-provider',
      name: 'My Custom Provider',
      baseURL: 'https://api.custom.com/v1',
    };

    render(
      <TestApp>
        <AddSharedProviderDialog
          open={true}
          onOpenChange={onOpenChange}
          provider={customProvider}
        />
      </TestApp>
    );

    // Should use the id as the name since it's not in presets
    expect(screen.getByText(/Add my-custom-provider to your configuration/i)).toBeInTheDocument();
  });
});
