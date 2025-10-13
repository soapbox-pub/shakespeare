import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { URLFragmentHandler } from './URLFragmentHandler';

// Mock the AddProviderDialog component
vi.mock('./AddProviderDialog', () => ({
  AddProviderDialog: ({ open, provider }: { open: boolean; provider: { id: string; baseURL: string; apiKey?: string; nostr?: boolean; proxy?: boolean } }) => {
    if (!open) return null;
    return (
      <div data-testid="add-provider-dialog">
        <div>Provider ID: {provider.id}</div>
        <div>Base URL: {provider.baseURL}</div>
        {provider.apiKey && <div>API Key: {provider.apiKey}</div>}
        {provider.nostr && <div>Nostr: true</div>}
        {provider.proxy && <div>Proxy: true</div>}
      </div>
    );
  },
}));

describe('URLFragmentHandler', () => {
  const originalHash = window.location.hash;

  beforeEach(() => {
    // Clear hash before each test
    window.location.hash = '';
  });

  afterEach(() => {
    // Restore original hash
    window.location.hash = originalHash;
  });

  it('does not render dialog when no hash is present', () => {
    window.location.hash = '';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    expect(screen.queryByTestId('add-provider-dialog')).not.toBeInTheDocument();
  });

  it('does not render dialog when hash does not contain provider params', () => {
    window.location.hash = '#some-random-hash';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    expect(screen.queryByTestId('add-provider-dialog')).not.toBeInTheDocument();
  });

  it('parses provider from URL fragment and displays dialog', async () => {
    window.location.hash = '#id=openrouter&baseURL=https://openrouter.ai/api/v1';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-provider-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Provider ID: openrouter')).toBeInTheDocument();
    expect(screen.getByText('Base URL: https://openrouter.ai/api/v1')).toBeInTheDocument();
  });

  it('parses API key from URL fragment', async () => {
    window.location.hash = '#id=openrouter&baseURL=https://openrouter.ai/api/v1&apiKey=sk-test-123';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-provider-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('API Key: sk-test-123')).toBeInTheDocument();
  });

  it('parses nostr flag from URL fragment', async () => {
    window.location.hash = '#id=shakespeare&baseURL=https://ai.shakespeare.diy/v1&nostr=true';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-provider-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Nostr: true')).toBeInTheDocument();
  });

  it('parses proxy flag from URL fragment', async () => {
    window.location.hash = '#id=custom&baseURL=https://api.custom.com/v1&proxy=true';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-provider-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Proxy: true')).toBeInTheDocument();
  });

  it('parses all parameters from complete URL', async () => {
    window.location.hash = '#id=openrouter&baseURL=https://openrouter.ai/api&apiKey=sk-b7719bfc06f04bb29086f380969c76eb&nostr=false&proxy=true';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-provider-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Provider ID: openrouter')).toBeInTheDocument();
    expect(screen.getByText('Base URL: https://openrouter.ai/api')).toBeInTheDocument();
    expect(screen.getByText('API Key: sk-b7719bfc06f04bb29086f380969c76eb')).toBeInTheDocument();
    expect(screen.getByText('Proxy: true')).toBeInTheDocument();
  });

  it('requires both id and baseURL to show dialog', () => {
    window.location.hash = '#id=openrouter';

    render(
      <TestApp>
        <URLFragmentHandler />
      </TestApp>
    );

    expect(screen.queryByTestId('add-provider-dialog')).not.toBeInTheDocument();
  });
});
