import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { LanguagePicker } from './LanguagePicker';

describe('LanguagePicker', () => {
  it('renders language picker with default English selection', () => {
    render(
      <TestApp>
        <LanguagePicker />
      </TestApp>
    );

    // Should show the trigger button
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows language options when opened', async () => {
    render(
      <TestApp>
        <LanguagePicker />
      </TestApp>
    );

    // Click to open the dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Should show all language options (using getAllByText since there might be duplicates)
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
    expect(screen.getAllByText('English').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Portuguese').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Chinese').length).toBeGreaterThan(0);
  });

  it('displays flag emojis for languages', async () => {
    render(
      <TestApp>
        <LanguagePicker />
      </TestApp>
    );

    // Click to open the dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Should show flag emojis (using getAllByText since there might be duplicates)
    expect(screen.getAllByText('🇺🇸').length).toBeGreaterThan(0);
    expect(screen.getAllByText('🇧🇷').length).toBeGreaterThan(0);
    expect(screen.getAllByText('🇨🇳').length).toBeGreaterThan(0);
  });
});