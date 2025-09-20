import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { Preferences } from './Preferences';

describe('Preferences', () => {
  it('renders preferences page with language and theme sections', () => {
    render(
      <TestApp>
        <Preferences />
      </TestApp>
    );

    // Should show the preferences title
    expect(screen.getByText('Preferences')).toBeInTheDocument();

    // Should show theme and language labels at top level
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();

    // Should show language picker
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('displays translated content correctly', () => {
    render(
      <TestApp>
        <Preferences />
      </TestApp>
    );

    // Check for key translated strings
    expect(screen.getByText('Manage your general application preferences and appearance settings.')).toBeInTheDocument();
    expect(screen.getByText('Select your preferred language for the interface.')).toBeInTheDocument();
  });
});