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
  const { settings, addCredential, removeCredential, setCredentials, isConfigured } = useGitSettings();

  const handleAdd = () => {
    const credential: GitCredential = {
      id: crypto.randomUUID(),
      name: 'GitHub',
      protocol: 'https',
      host: 'github.com',
      username: 'git',
      password: 'test-token',
    };
    addCredential(credential);
  };

  const handleUpdate = () => {
    const githubCred = settings.credentials.find(c => c.host === 'github.com');
    if (githubCred) {
      const updatedCredentials = settings.credentials.map((cred) =>
        cred.id === githubCred.id ? { ...cred, password: 'updated-token' } : cred
      );
      setCredentials(updatedCredentials);
    }
  };

  const handleRemove = () => {
    const githubCred = settings.credentials.find(c => c.host === 'github.com');
    if (githubCred) {
      removeCredential(githubCred.id);
    }
  };

  const githubCred = settings.credentials.find(c => c.host === 'github.com');

  return (
    <div>
      <div data-testid="configured">{isConfigured ? 'configured' : 'not-configured'}</div>
      <div data-testid="count">{settings.credentials.length}</div>
      <button onClick={handleAdd}>Add GitHub</button>
      <button onClick={handleUpdate}>Update GitHub</button>
      <button onClick={handleRemove}>Remove GitHub</button>
      {githubCred && (
        <div data-testid="github-creds">
          {githubCred.username}:
          {githubCred.password}
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
      credentials: [],
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
          credentials: expect.arrayContaining([
            expect.objectContaining({
              protocol: 'https',
              host: 'github.com',
              username: 'git',
              password: 'test-token',
            })
          ])
        }),
        '/config' // configPath
      );
    });
  });

  it('loads settings from VFS', async () => {
    const settings = {
      credentials: [
        {
          id: crypto.randomUUID(),
          name: 'GitLab',
          protocol: 'https',
          host: 'gitlab.com',
          username: 'git',
          password: 'gitlab-token',
        },
      ],
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