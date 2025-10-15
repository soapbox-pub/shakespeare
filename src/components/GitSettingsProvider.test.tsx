import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { GitSettingsProvider } from './GitSettingsProvider';
import { useGitSettings } from '@/hooks/useGitSettings';
import type { GitCredential } from '@/contexts/GitSettingsContext';
import { TestApp } from '@/test/TestApp';

// Mock the config utils
vi.mock('@/lib/configUtils', () => ({
  readGitSettings: vi.fn(),
  writeGitSettings: vi.fn(),
}));

// Test component that uses the hook
function TestComponent() {
  const { settings, addCredential, removeCredential, updateCredential, isConfigured } = useGitSettings();

  const handleAdd = () => {
    const credential: GitCredential = {
      username: 'git',
      password: 'test-token',
    };
    addCredential('https://github.com', credential);
  };

  const handleUpdate = () => {
    updateCredential('https://github.com', { password: 'updated-token' });
  };

  const handleRemove = () => {
    removeCredential('https://github.com');
  };

  return (
    <div>
      <div data-testid="configured">{isConfigured ? 'configured' : 'not-configured'}</div>
      <div data-testid="count">{Object.keys(settings.credentials).length}</div>
      <button onClick={handleAdd}>Add GitHub</button>
      <button onClick={handleUpdate}>Update GitHub</button>
      <button onClick={handleRemove}>Remove GitHub</button>
      {settings.credentials['https://github.com'] && (
        <div data-testid="github-creds">
          {settings.credentials['https://github.com'].username}:
          {settings.credentials['https://github.com'].password}
        </div>
      )}
    </div>
  );
}

function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <TestApp>
      <GitSettingsProvider>
        {children}
      </GitSettingsProvider>
    </TestApp>
  );
}

describe('GitSettingsProvider', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock the read function to return default settings
    const { readGitSettings } = await import('@/lib/configUtils');
    vi.mocked(readGitSettings).mockResolvedValue({
      credentials: {},
      hostTokens: {},
    });
  });

  it('provides initial empty state', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('can add credentials', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    });

    fireEvent.click(screen.getByText('Add GitHub'));

    expect(screen.getByTestId('configured')).toHaveTextContent('configured');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('github-creds')).toHaveTextContent('git:test-token');
  });

  it('can update credentials', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    });

    // First add a credential
    fireEvent.click(screen.getByText('Add GitHub'));
    expect(screen.getByTestId('github-creds')).toHaveTextContent('git:test-token');

    // Then update it
    fireEvent.click(screen.getByText('Update GitHub'));
    expect(screen.getByTestId('github-creds')).toHaveTextContent('git:updated-token');
  });

  it('can remove credentials', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    });

    // First add a credential
    fireEvent.click(screen.getByText('Add GitHub'));
    expect(screen.getByTestId('configured')).toHaveTextContent('configured');
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    // Then remove it
    fireEvent.click(screen.getByText('Remove GitHub'));
    expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('persists settings to VFS', async () => {
    const { writeGitSettings } = await import('@/lib/configUtils');

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    });

    fireEvent.click(screen.getByText('Add GitHub'));

    // Check that settings were saved to VFS
    await waitFor(() => {
      expect(writeGitSettings).toHaveBeenCalledWith(
        expect.anything(), // fs instance
        expect.objectContaining({
          credentials: {
            'https://github.com': {
              username: 'git',
              password: 'test-token',
            }
          }
        })
      );
    });
  });

  it('loads settings from VFS', async () => {
    const settings = {
      credentials: {
        'https://gitlab.com': {
          username: 'git',
          password: 'gitlab-token',
        },
      },
      hostTokens: {},
    };

    const { readGitSettings } = await import('@/lib/configUtils');
    vi.mocked(readGitSettings).mockResolvedValue(settings);

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('configured')).toHaveTextContent('configured');
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
  });


});