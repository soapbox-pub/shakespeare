import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ZipImportDialog } from './ZipImportDialog';
import { TestApp } from '@/test/TestApp';

// Mock the useProjects hook
const mockProjects = [
  { id: 'test-project', name: 'Test Project', path: '/projects/test-project', lastModified: new Date() }
];

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    data: mockProjects,
    isLoading: false,
    error: null
  })
}));

describe('ZipImportDialog', () => {
  const mockOnImport = vi.fn();
  const defaultProps = {
    onImport: mockOnImport,
    disabled: false
  };

  beforeEach(() => {
    mockOnImport.mockClear();
    vi.clearAllMocks();
  });

  it('renders dialog trigger button', () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    expect(screen.getByText('Import ZIP')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', async () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    const triggerButton = screen.getByText('Import ZIP');
    fireEvent.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByText('Import Project from ZIP')).toBeInTheDocument();
    });
  });

  it('processes file selection without displaying project ID', async () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    // Open dialog
    const triggerButton = screen.getByText('Import ZIP');
    fireEvent.click(triggerButton);

    // Create a mock file
    const file = new File(['test content'], 'my-project.zip', { type: 'application/zip' });

    // Find the hidden file input by ref
    const fileInput = document.querySelector('input[type="file"][accept=".zip"]');

    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    await waitFor(() => {
      // Verify that the file name is displayed (from the file selection area)
      expect(screen.getByText('my-project.zip')).toBeInTheDocument();
      // Verify that Project ID label is not displayed
      expect(screen.queryByText('Project ID')).not.toBeInTheDocument();
    });
  });

  it('shows overwrite warning when project ID already exists', async () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    // Open dialog
    const triggerButton = screen.getByText('Import ZIP');
    fireEvent.click(triggerButton);

    // Create a mock file that will generate an existing project ID
    const file = new File(['test content'], 'test-project.zip', { type: 'application/zip' });

    // Find the hidden file input by ref
    const fileInput = document.querySelector('input[type="file"][accept=".zip"]');

    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    await waitFor(() => {
      expect(screen.getByText(/A project with this ID already exists/)).toBeInTheDocument();
      expect(screen.getByText('Overwrite Project')).toBeInTheDocument();
    });
  });

  it('calls onImport with correct parameters when import button is clicked', async () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    // Open dialog
    const triggerButton = screen.getByText('Import ZIP');
    fireEvent.click(triggerButton);

    // Create a mock file
    const file = new File(['test content'], 'new-project.zip', { type: 'application/zip' });

    // Find the hidden file input by ref
    const fileInput = document.querySelector('input[type="file"][accept=".zip"]');

    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    // Wait for file to be processed
    await waitFor(() => {
      expect(screen.getByText('new-project.zip')).toBeInTheDocument();
    });

    // Click import button
    const importButton = screen.getByText('Import Project');
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalledWith(file, false, "new-project");
    });
  });

  it('shows overwrite confirmation dialog when overwrite button is clicked', async () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    // Open dialog
    const triggerButton = screen.getByText('Import ZIP');
    fireEvent.click(triggerButton);

    // Create a mock file that will generate an existing project ID
    const file = new File(['test content'], 'test-project.zip', { type: 'application/zip' });

    // Find the hidden file input by ref
    const fileInput = document.querySelector('input[type="file"][accept=".zip"]');

    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    // Wait for overwrite button to appear
    await waitFor(() => {
      expect(screen.getByText('Overwrite Project')).toBeInTheDocument();
    });

    // Click overwrite button
    const overwriteButton = screen.getByText('Overwrite Project');
    fireEvent.click(overwriteButton);

    // Check for overwrite confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Overwrite Existing Project')).toBeInTheDocument();
      // Use a more flexible matcher for the text that might be split across elements
      const dialogContent = screen.getByText('Overwrite Existing Project').closest('.AlertDialogContent');
      if (dialogContent) {
        expect(dialogContent.textContent).toContain('A project with the ID "test-project" already exists');
      }
    }, { timeout: 2000 });
  });

  it('does not show project ID input field (simplified interface)', async () => {
    render(
      <TestApp>
        <ZipImportDialog {...defaultProps} />
      </TestApp>
    );

    // Open dialog
    const triggerButton = screen.getByText('Import ZIP');
    fireEvent.click(triggerButton);

    // Check that there's no input field for project ID
    expect(screen.queryByLabelText('Project ID')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('project-name')).not.toBeInTheDocument();
  });
});