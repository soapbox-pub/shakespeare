import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactNode } from 'react';
import { GitSettingsProvider } from './GitSettingsProvider';
import { useGitSettings } from '@/hooks/useGitSettings';
import type { GitCredential } from '@/contexts/GitSettingsContext';

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
    <GitSettingsProvider>
      {children}
    </GitSettingsProvider>
  );
}

describe('GitSettingsProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides initial empty state', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('can add credentials', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Add GitHub'));

    expect(screen.getByTestId('configured')).toHaveTextContent('configured');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('github-creds')).toHaveTextContent('git:test-token');
  });

  it('can update credentials', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // First add a credential
    fireEvent.click(screen.getByText('Add GitHub'));
    expect(screen.getByTestId('github-creds')).toHaveTextContent('git:test-token');

    // Then update it
    fireEvent.click(screen.getByText('Update GitHub'));
    expect(screen.getByTestId('github-creds')).toHaveTextContent('git:updated-token');
  });

  it('can remove credentials', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // First add a credential
    fireEvent.click(screen.getByText('Add GitHub'));
    expect(screen.getByTestId('configured')).toHaveTextContent('configured');
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    // Then remove it
    fireEvent.click(screen.getByText('Remove GitHub'));
    expect(screen.getByTestId('configured')).toHaveTextContent('not-configured');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('persists settings to localStorage', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Add GitHub'));

    // Check that settings were saved to localStorage
    const stored = localStorage.getItem('git-settings');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed.credentials['https://github.com']).toEqual({
      username: 'git',
      password: 'test-token',
    });
  });

  it('loads settings from localStorage', () => {
    // Pre-populate localStorage
    const settings = {
      credentials: {
        'https://gitlab.com': {
          username: 'git',
          password: 'gitlab-token',
        },
      },
    };
    localStorage.setItem('git-settings', JSON.stringify(settings));

    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(screen.getByTestId('configured')).toHaveTextContent('configured');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});