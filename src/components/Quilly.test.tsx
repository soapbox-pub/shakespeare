import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Quilly } from './Quilly';

describe('Quilly', () => {
  it('renders with error message', () => {
    const error = new Error('Test error message');
    const onDismiss = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Pardon the interruption')).toBeInTheDocument();
    expect(screen.getByText(/AI service error: Test error message/)).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const error = new Error('Test error');
    const onDismiss = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole('button');
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders action button for console errors', () => {
    const error = new Error('Console errors detected in your app. Would you like me to help fix them?');
    const onDismiss = vi.fn();
    const onFixConsoleErrors = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
        onFixConsoleErrors={onFixConsoleErrors}
      />
    );

    const actionButton = screen.getByRole('button', { name: 'Fix errors' });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(onFixConsoleErrors).toHaveBeenCalledTimes(1);
  });

  it('renders action button for model not found errors', () => {
    const error = new Error('model_not_found: The specified model does not exist');
    const onDismiss = vi.fn();
    const onOpenModelSelector = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
        onOpenModelSelector={onOpenModelSelector}
      />
    );

    const actionButton = screen.getByRole('button', { name: 'Choose model' });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(onOpenModelSelector).toHaveBeenCalledTimes(1);
  });

  it('formats network error messages correctly', () => {
    const error = new TypeError('fetch failed');
    const onDismiss = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText(/Network error: Unable to connect to AI service/)).toBeInTheDocument();
  });

  it('formats API key error messages correctly', () => {
    const error = new Error('Invalid API key provided');
    const onDismiss = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText(/Authentication error: Please check your API key/)).toBeInTheDocument();
  });

  it('formats rate limit error messages correctly', () => {
    const error = new Error('Rate limit exceeded');
    const onDismiss = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
  });

  it('formats context length error messages correctly', () => {
    const error = new Error('maximum context length is 4096 tokens');
    const onDismiss = vi.fn();

    render(
      <Quilly
        error={error}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText(/Your conversation is too long for this model/)).toBeInTheDocument();
  });
});