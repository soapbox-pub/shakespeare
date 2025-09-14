import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileAttachment } from './file-attachment';

describe('FileAttachment', () => {
  it('renders the attachment button', () => {
    const onFileSelect = vi.fn();
    
    render(
      <FileAttachment onFileSelect={onFileSelect} />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('calls onFileSelect when file is selected', async () => {
    const onFileSelect = vi.fn();
    
    render(
      <FileAttachment onFileSelect={onFileSelect} />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Create a mock file
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    // Mock the file input change event
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('displays selected files', () => {
    const onFileSelect = vi.fn();
    const onFileRemove = vi.fn();
    const selectedFiles = [
      new File(['content1'], 'file1.txt', { type: 'text/plain' }),
      new File(['content2'], 'file2.txt', { type: 'text/plain' }),
    ];
    
    render(
      <FileAttachment 
        onFileSelect={onFileSelect}
        onFileRemove={onFileRemove}
        selectedFiles={selectedFiles}
      />
    );

    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.getByText('file2.txt')).toBeInTheDocument();
  });

  it('calls onFileRemove when remove button is clicked', () => {
    const onFileSelect = vi.fn();
    const onFileRemove = vi.fn();
    const selectedFiles = [
      new File(['content'], 'test.txt', { type: 'text/plain' }),
    ];
    
    render(
      <FileAttachment 
        onFileSelect={onFileSelect}
        onFileRemove={onFileRemove}
        selectedFiles={selectedFiles}
      />
    );

    const removeButtons = screen.getAllByRole('button');
    // First button is the attachment button, second is the remove button
    const removeButton = removeButtons[1];
    
    fireEvent.click(removeButton);

    expect(onFileRemove).toHaveBeenCalledWith(selectedFiles[0]);
  });

  it('disables interaction when disabled prop is true', () => {
    const onFileSelect = vi.fn();
    
    render(
      <FileAttachment onFileSelect={onFileSelect} disabled={true} />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeDisabled();
  });
});