import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import StorageSettings from './StorageSettings';

describe('StorageSettings', () => {
  it('renders the storage settings page correctly', () => {
    render(
      <TestApp>
        <StorageSettings />
      </TestApp>
    );

    // Check for main heading
    expect(screen.getByText('Storage')).toBeInTheDocument();

    // Check for description
    expect(screen.getByText('Export files and manage local data.')).toBeInTheDocument();

    // Check for Persist Data section
    expect(screen.getByText('Persist Data')).toBeInTheDocument();

    // Check for Export Files section
    expect(screen.getByText('Export Files')).toBeInTheDocument();
    expect(screen.getByText('Export All Files')).toBeInTheDocument();

    // Check for Clear All Data section
    expect(screen.getAllByText('Clear All Data')).toHaveLength(2); // Title and button
    expect(screen.getByRole('button', { name: /clear all data/i })).toBeInTheDocument();
  });

  it('shows persist data toggle, export and clear buttons', () => {
    render(
      <TestApp>
        <StorageSettings />
      </TestApp>
    );

    // Persist storage toggle should be visible
    const persistToggle = screen.getByRole('switch');
    expect(persistToggle).toBeInTheDocument();

    // Export button should be visible
    const exportButton = screen.getByRole('button', { name: /export all files/i });
    expect(exportButton).toBeInTheDocument();
    expect(exportButton).not.toBeDisabled();

    // Clear data button should be visible
    const clearButton = screen.getByRole('button', { name: /clear all data/i });
    expect(clearButton).toBeInTheDocument();
    expect(clearButton).not.toBeDisabled();
  });
});