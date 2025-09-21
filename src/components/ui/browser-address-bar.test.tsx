import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserAddressBar } from './browser-address-bar';

describe('BrowserAddressBar', () => {
  it('renders navigation buttons and address input', () => {
    render(<BrowserAddressBar />);

    expect(screen.getByTitle('Go back')).toBeInTheDocument();
    expect(screen.getByTitle('Go forward')).toBeInTheDocument();
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

  it('disables back/forward buttons based on canGoBack/canGoForward props', () => {
    render(
      <BrowserAddressBar
        canGoBack={false}
        canGoForward={true}
      />
    );

    expect(screen.getByTitle('Go back')).toBeDisabled();
    expect(screen.getByTitle('Go forward')).not.toBeDisabled();
  });

  it('calls navigation handlers when buttons are clicked', () => {
    const onBack = vi.fn();
    const onForward = vi.fn();
    const onRefresh = vi.fn();

    render(
      <BrowserAddressBar
        onBack={onBack}
        onForward={onForward}
        onRefresh={onRefresh}
        canGoBack={true}
        canGoForward={true}
      />
    );

    fireEvent.click(screen.getByTitle('Go back'));
    fireEvent.click(screen.getByTitle('Go forward'));
    fireEvent.click(screen.getByTitle('Refresh'));

    expect(onBack).toHaveBeenCalled();
    expect(onForward).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
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
});