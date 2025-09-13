import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { GitSettingsDialog } from './GitSettingsDialog';

describe('GitSettingsDialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the dialog with trigger button', () => {
    render(
      <TestApp>
        <GitSettingsDialog />
      </TestApp>
    );

    expect(screen.getByRole('button', { name: /git settings/i })).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    render(
      <TestApp>
        <GitSettingsDialog />
      </TestApp>
    );

    fireEvent.click(screen.getByRole('button', { name: /git settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Git Settings' })).toBeInTheDocument();
    });
  });

  it('shows preset providers (GitHub and GitLab)', async () => {
    render(
      <TestApp>
        <GitSettingsDialog open={true} />
      </TestApp>
    );

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();
  });

  it('can add a preset provider with token', async () => {
    render(
      <TestApp>
        <GitSettingsDialog open={true} />
      </TestApp>
    );

    // Find GitHub token input and add button
    const tokenInputs = screen.getAllByPlaceholderText('Enter your token');
    const addButtons = screen.getAllByText('Add');

    // Assuming GitHub is the first preset
    const githubTokenInput = tokenInputs[0];
    const githubAddButton = addButtons[0];

    expect(githubTokenInput).toBeInTheDocument();
    expect(githubAddButton).toBeInTheDocument();

    fireEvent.change(githubTokenInput, { target: { value: 'test-token' } });
    fireEvent.click(githubAddButton);

    // Check that the provider was added to configured providers
    await waitFor(() => {
      expect(screen.getByText('Configured Credentials')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('can add custom provider', async () => {
    render(
      <TestApp>
        <GitSettingsDialog open={true} />
      </TestApp>
    );

    // Fill custom provider form
    const originInput = screen.getByLabelText(/origin/i);
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const addCustomButton = screen.getByRole('button', { name: /add custom provider/i });

    fireEvent.change(originInput, { target: { value: 'https://git.example.com' } });
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'testpass' } });

    expect(addCustomButton).not.toBeDisabled();
    fireEvent.click(addCustomButton);

    // Check that the provider was added
    await waitFor(() => {
      expect(screen.getByText('Configured Credentials')).toBeInTheDocument();
    });
  });

  it('shows red dot when not configured', () => {
    render(
      <TestApp>
        <GitSettingsDialog />
      </TestApp>
    );

    // Check for red dot indicator
    const redDot = document.querySelector('.bg-red-500');
    expect(redDot).toBeInTheDocument();
  });

  it('validates custom provider form', () => {
    render(
      <TestApp>
        <GitSettingsDialog open={true} />
      </TestApp>
    );

    const addCustomButton = screen.getByRole('button', { name: /add custom provider/i });

    // Button should be disabled when form is empty
    expect(addCustomButton).toBeDisabled();

    // Fill only origin
    const originInput = screen.getByLabelText(/origin/i);
    fireEvent.change(originInput, { target: { value: 'https://git.example.com' } });
    expect(addCustomButton).toBeDisabled();

    // Fill origin and username
    const usernameInput = screen.getByLabelText(/username/i);
    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    expect(addCustomButton).toBeDisabled();

    // Fill all fields
    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: 'testpass' } });
    expect(addCustomButton).not.toBeDisabled();
  });
});