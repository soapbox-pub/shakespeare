import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { AboutSettings } from './AboutSettings';

// Mock fetch
global.fetch = vi.fn();

describe('AboutSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders about settings page with project information', () => {
    render(
      <TestApp>
        <AboutSettings />
      </TestApp>
    );

    expect(screen.getByText('About Shakespeare')).toBeInTheDocument();
    expect(screen.getByText(/Information about Shakespeare/)).toBeInTheDocument();
    expect(screen.getByText('Source Code')).toBeInTheDocument();
    expect(screen.getByText('View on GitLab')).toBeInTheDocument();
  });

  it('fetches and displays license text', async () => {
    const mockLicense = 'MIT License\n\nCopyright (c) 2024 Shakespeare';
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockLicense),
    } as Response);

    render(
      <TestApp>
        <AboutSettings />
      </TestApp>
    );

    // Initially shows loading
    expect(screen.getByText('Loading license...')).toBeInTheDocument();

    // Wait for license to load
    await waitFor(() => {
      expect(screen.getByText(/MIT License/)).toBeInTheDocument();
      expect(screen.getByText(/Copyright \(c\) 2024 Shakespeare/)).toBeInTheDocument();
    });

    // Verify fetch was called with correct URL
    expect(global.fetch).toHaveBeenCalledWith('/LICENSE.txt');
  });

  it('shows error when license fetch fails', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestApp>
        <AboutSettings />
      </TestApp>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Failed to load license/)).toBeInTheDocument();
    });
  });
});