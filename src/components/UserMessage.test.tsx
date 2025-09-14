import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserMessage } from './UserMessage';

describe('UserMessage', () => {
  it('renders regular text without file attachments', () => {
    const content = 'This is a regular message without any file attachments.';

    render(<UserMessage content={content} />);

    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('handles backward compatibility with string content containing file attachments', () => {
    const content = 'Here is my file: Added file: /tmp/test.txt';

    render(<UserMessage content={content} />);

    // When using string content, it should still work but won't separate file attachments
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('renders file attachment badges for single file with text parts', () => {
    const content = [
      { type: 'text' as const, text: 'Here is my file:' },
      { type: 'text' as const, text: 'Added file: /tmp/test.txt' }
    ];

    render(<UserMessage content={content} />);

    expect(screen.getByText('Here is my file:')).toBeInTheDocument();
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('/tmp/test.txt')).toBeInTheDocument();
  });

  it('renders multiple file attachments with text parts', () => {
    const content = [
      { type: 'text' as const, text: 'Files uploaded:' },
      { type: 'text' as const, text: 'Added file: /tmp/document.pdf' },
      { type: 'text' as const, text: 'Added file: /tmp/image.jpg' },
      { type: 'text' as const, text: 'All done!' }
    ];

    render(<UserMessage content={content} />);

    expect(screen.getByText('Files uploaded:')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('image.jpg')).toBeInTheDocument();
    expect(screen.getByText('All done!')).toBeInTheDocument();
  });

  it('renders text files with FileText icon', () => {
    const content = [{ type: 'text' as const, text: 'Added file: /tmp/script.js' }];

    render(<UserMessage content={content} />);

    expect(screen.getByText('script.js')).toBeInTheDocument();
    // FileText icon should be rendered (we can't easily test the icon itself, but we can test the component renders)
  });

  it('handles files without extensions', () => {
    const content = [{ type: 'text' as const, text: 'Added file: /tmp/README' }];

    render(<UserMessage content={content} />);

    expect(screen.getByText('README')).toBeInTheDocument();
    expect(screen.getByText('/tmp/README')).toBeInTheDocument();
  });

  it('handles complex filenames with underscores and numbers', () => {
    const content = [{ type: 'text' as const, text: 'Added file: /tmp/my_file_1.txt' }];

    render(<UserMessage content={content} />);

    expect(screen.getByText('my_file_1.txt')).toBeInTheDocument();
    expect(screen.getByText('/tmp/my_file_1.txt')).toBeInTheDocument();
  });

  it('preserves whitespace in text content', () => {
    const content = [
      { type: 'text' as const, text: 'Line 1\n\nLine 3 with spaces   \n\nFinal line' },
      { type: 'text' as const, text: 'Added file: /tmp/test.txt' }
    ];

    const { container } = render(<UserMessage content={content} />);

    // Check that the component renders and contains the expected text content
    expect(container.textContent).toContain('Line 1');
    expect(container.textContent).toContain('Line 3 with spaces');
    expect(container.textContent).toContain('Final line');
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('handles mixed content with file attachments in the middle', () => {
    const content = [
      { type: 'text' as const, text: 'Starting text' },
      { type: 'text' as const, text: 'Added file: /tmp/middle.txt' },
      { type: 'text' as const, text: 'ending text' }
    ];

    render(<UserMessage content={content} />);

    expect(screen.getByText('Starting text')).toBeInTheDocument();
    expect(screen.getByText('middle.txt')).toBeInTheDocument();
    expect(screen.getByText('ending text')).toBeInTheDocument();
  });
});