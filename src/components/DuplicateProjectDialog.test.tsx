import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DuplicateProjectDialog } from './DuplicateProjectDialog';
import { TestApp } from '@/test/TestApp';

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('DuplicateProjectDialog', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders dialog when open', () => {
    render(
      <TestApp>
        <DuplicateProjectDialog
          projectId="test-project"
          projectName="Test Project"
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Duplicate Project' })).toBeInTheDocument();
    expect(screen.getByText('Create a copy of this project with a new name')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(
      <TestApp>
        <DuplicateProjectDialog
          projectId="test-project"
          projectName="Test Project"
          open={false}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows default project name with -copy suffix', () => {
    render(
      <TestApp>
        <DuplicateProjectDialog
          projectId="test-project"
          projectName="Test Project"
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    const input = screen.getByLabelText('New Project Name');
    expect(input).toHaveValue('Test Project-copy');
  });

  it('allows changing the project name', async () => {
    const user = userEvent.setup();

    render(
      <TestApp>
        <DuplicateProjectDialog
          projectId="test-project"
          projectName="Test Project"
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    const input = screen.getByLabelText('New Project Name');
    await user.clear(input);
    await user.type(input, 'My New Project');

    expect(input).toHaveValue('My New Project');
  });

  it('disables duplicate button when name is empty', async () => {
    const user = userEvent.setup();

    render(
      <TestApp>
        <DuplicateProjectDialog
          projectId="test-project"
          projectName="Test Project"
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    const input = screen.getByLabelText('New Project Name');
    const duplicateButton = screen.getByRole('button', { name: /Duplicate Project/i });

    // Clear the input
    await user.clear(input);

    // Button should be disabled when input is empty
    expect(duplicateButton).toBeDisabled();
  });

  it('closes dialog when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <DuplicateProjectDialog
          projectId="test-project"
          projectName="Test Project"
          open={true}
          onOpenChange={onOpenChange}
        />
      </TestApp>
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
