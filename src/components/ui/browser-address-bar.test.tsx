import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserAddressBar } from './browser-address-bar';

describe('BrowserAddressBar', () => {
  it('renders address input and refresh button', () => {
    render(<BrowserAddressBar onRefresh={vi.fn()} />);

    expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter path (e.g., /, /about)')).toBeInTheDocument();
  });

  it('calls onNavigate with proper path when form is submitted', () => {
    const onNavigate = vi.fn();
    render(<BrowserAddressBar onNavigate={onNavigate} />);

    const input = screen.getByPlaceholderText('Enter path (e.g., /, /about)');
    fireEvent.change(input, { target: { value: 'about' } });
    fireEvent.submit(input.closest('form')!);

    expect(onNavigate).toHaveBeenCalledWith('/about');
  });

  it('disables input when no onNavigate handler is provided', () => {
    render(<BrowserAddressBar />);

    // Input should be disabled when no onNavigate handler is provided
    expect(screen.getByPlaceholderText('Enter path (e.g., /, /about)')).toBeDisabled();
  });

  it('shows refresh button inside input when onRefresh handler is provided', () => {
    const onRefresh = vi.fn();
    render(<BrowserAddressBar onRefresh={onRefresh} />);

    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeInTheDocument();

    fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('does not show refresh button when no onRefresh handler is provided', () => {
    render(<BrowserAddressBar />);

    expect(screen.queryByTitle('Refresh')).not.toBeInTheDocument();
  });

  it('updates input value when currentPath prop changes', () => {
    const { rerender } = render(<BrowserAddressBar currentPath="/" />);

    const input = screen.getByPlaceholderText('Enter path (e.g., /, /about)');
    expect(input).toHaveValue('/');

    // Re-render with new currentPath
    rerender(<BrowserAddressBar currentPath="/about" />);

    expect(input).toHaveValue('/about');

    // Re-render with another path
    rerender(<BrowserAddressBar currentPath="/contact" />);

    expect(input).toHaveValue('/contact');
  });



  it('shows navigation history dropdown when input is focused', () => {
    const navigationHistory = ['/', '/about', '/contact'];
    render(
      <BrowserAddressBar
        navigationHistory={navigationHistory}
        onNavigate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Enter path (e.g., /, /about)');
    fireEvent.focus(input);

    // History should be shown in reverse order (most recent first)
    expect(screen.getByText('/contact')).toBeInTheDocument();
    expect(screen.getByText('/about')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('does not show history dropdown when navigationHistory is empty', () => {
    render(
      <BrowserAddressBar
        navigationHistory={[]}
        onNavigate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Enter path (e.g., /, /about)');
    fireEvent.focus(input);

    // No history items should be visible
    expect(screen.queryByRole('button', { name: /\// })).not.toBeInTheDocument();
  });

  it('navigates when clicking a history item', () => {
    const onNavigate = vi.fn();
    const navigationHistory = ['/', '/about', '/contact'];
    render(
      <BrowserAddressBar
        navigationHistory={navigationHistory}
        onNavigate={onNavigate}
      />
    );

    const input = screen.getByPlaceholderText('Enter path (e.g., /, /about)');
    fireEvent.focus(input);

    const aboutButton = screen.getByText('/about');
    fireEvent.click(aboutButton);

    expect(onNavigate).toHaveBeenCalledWith('/about');
  });

  it('removes duplicate paths from history', () => {
    const navigationHistory = ['/', '/about', '/', '/contact', '/about'];
    render(
      <BrowserAddressBar
        navigationHistory={navigationHistory}
        onNavigate={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Enter path (e.g., /, /about)');
    fireEvent.focus(input);

    // Should only show unique paths
    const allButtons = screen.getAllByRole('button');
    // Filter out the refresh button if present, only count history items
    const historyButtons = allButtons.filter(btn =>
      btn.textContent === '/' ||
      btn.textContent === '/about' ||
      btn.textContent === '/contact'
    );

    expect(historyButtons).toHaveLength(3);
  });
});