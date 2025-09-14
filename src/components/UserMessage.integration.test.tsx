import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserMessage } from './UserMessage';

describe('UserMessage Integration', () => {
  it('renders text parts with file attachments correctly', () => {
    // Simulate the new text parts structure that ChatPane would create
    const content = [
      { type: 'text' as const, text: 'Please analyze this file:' },
      { type: 'text' as const, text: 'Added file: /tmp/data.csv' },
      { type: 'text' as const, text: 'Let me know what you find!' }
    ];

    render(<UserMessage content={content} />);

    // Check that regular text is displayed
    expect(screen.getByText('Please analyze this file:')).toBeInTheDocument();
    expect(screen.getByText('Let me know what you find!')).toBeInTheDocument();

    // Check that file attachment is rendered as a badge
    expect(screen.getByText('data.csv')).toBeInTheDocument();
    // Full path should not be displayed
    expect(screen.queryByText('/tmp/data.csv')).not.toBeInTheDocument();
  });

  it('handles single text part with file attachment', () => {
    const content = [
      { type: 'text' as const, text: 'Added file: /tmp/script.js' }
    ];

    render(<UserMessage content={content} />);

    expect(screen.getByText('script.js')).toBeInTheDocument();
    // Full path should not be displayed
    expect(screen.queryByText('/tmp/script.js')).not.toBeInTheDocument();
  });

  it('handles multiple file attachments in separate parts', () => {
    const content = [
      { type: 'text' as const, text: 'Here are my files:' },
      { type: 'text' as const, text: 'Added file: /tmp/config.json' },
      { type: 'text' as const, text: 'Added file: /tmp/styles.css' },
      { type: 'text' as const, text: 'Added file: /tmp/main.js' }
    ];

    render(<UserMessage content={content} />);

    expect(screen.getByText('Here are my files:')).toBeInTheDocument();
    expect(screen.getByText('config.json')).toBeInTheDocument();
    expect(screen.getByText('styles.css')).toBeInTheDocument();
    expect(screen.getByText('main.js')).toBeInTheDocument();
  });

  it('handles empty content gracefully', () => {
    const content: Array<{ type: 'text'; text: string }> = [];

    const { container } = render(<UserMessage content={content} />);

    expect(container.firstChild).toBeNull();
  });
});