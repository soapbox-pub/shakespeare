import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { ProjectInfoDialog } from './ProjectInfoDialog';
import type { Project } from '@/lib/ProjectsManager';

// Mock the useProjectsManager hook
vi.mock('@/hooks/useProjectsManager', () => ({
  useProjectsManager: () => ({
    readFile: vi.fn().mockResolvedValue('{"description": "Test project", "version": "1.0.0"}'),
    getNostrRepoAddress: vi.fn().mockResolvedValue(null),
    listFiles: vi.fn().mockResolvedValue(['file1.js', 'file2.ts']),
  }),
}));

const mockProject: Project = {
  id: 'test-project',
  name: 'Test Project',
  path: '/projects/test-project',
  lastModified: new Date('2024-01-01T12:00:00Z'),
};

describe('ProjectInfoDialog', () => {
  it('renders project information when open', async () => {
    render(
      <TestApp>
        <ProjectInfoDialog
          project={mockProject}
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    // Check if the dialog title is rendered
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Project information and metadata')).toBeInTheDocument();

    // Check for basic information section
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Project ID:')).toBeInTheDocument();
    expect(screen.getByText('test-project')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TestApp>
        <ProjectInfoDialog
          project={mockProject}
          open={false}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    // Dialog should not be visible when closed
    expect(screen.queryByText('Test Project')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when dialog state changes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <ProjectInfoDialog
          project={mockProject}
          open={true}
          onOpenChange={onOpenChange}
        />
      </TestApp>
    );

    // Click the close button (X)
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state initially', () => {
    render(
      <TestApp>
        <ProjectInfoDialog
          project={mockProject}
          open={true}
          onOpenChange={() => {}}
        />
      </TestApp>
    );

    // Should show loading skeleton initially
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});