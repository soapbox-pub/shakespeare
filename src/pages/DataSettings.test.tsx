import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import DataSettings from './DataSettings';

describe('DataSettings', () => {
  it('renders the data settings page correctly', () => {
    render(
      <TestApp>
        <DataSettings />
      </TestApp>
    );

    // Check for main heading
    expect(screen.getByText('Data')).toBeInTheDocument();

    // Check for description
    expect(screen.getByText('Export your projects or clear all local data from this browser.')).toBeInTheDocument();

    // Check for Export Files section
    expect(screen.getByText('Export Files')).toBeInTheDocument();
    expect(screen.getByText('Export All Files')).toBeInTheDocument();

    // Check for Clear All Data section
    expect(screen.getAllByText('Clear All Data')).toHaveLength(2); // Title and button
    expect(screen.getByRole('button', { name: /clear all data/i })).toBeInTheDocument();
  });

  it('shows export and clear buttons', () => {
    render(
      <TestApp>
        <DataSettings />
      </TestApp>
    );

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