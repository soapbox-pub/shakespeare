import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectSidebar } from './ProjectSidebar';
import { useProjects } from '@/hooks/useProjects';
import { useLocalStorage } from '@/hooks/useLocalStorage';

// Mock the hooks
vi.mock('@/hooks/useProjects');
vi.mock('@/hooks/useLocalStorage');
vi.mock('@/hooks/useProjectSessionStatus', () => ({
  useProjectSessionStatus: () => ({ hasRunningSessions: false })
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn()
  })
}));

// Mock the LoginArea component
vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: ({ className }: { className?: string }) => (
    <div data-testid="login-area" className={className}>Login Area</div>
  )
}));

const mockUseProjects = vi.mocked(useProjects);
const mockUseLocalStorage = vi.mocked(useLocalStorage);

describe('ProjectSidebar', () => {
  beforeEach(() => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    } as unknown as ReturnType<typeof useProjects>);

    mockUseLocalStorage.mockReturnValue([[], vi.fn()]);
  });

  it('renders sidebar header with logo', () => {
    render(
      <ProjectSidebar
        selectedProject={null}
        onSelectProject={vi.fn()}
      />
    );

    expect(screen.getByText('🎭')).toBeInTheDocument();
    expect(screen.getByText('Shakespeare')).toBeInTheDocument();
  });

  it('shows collapse button when onToggleSidebar is provided', () => {
    const mockToggle = vi.fn();

    render(
      <ProjectSidebar
        selectedProject={null}
        onSelectProject={vi.fn()}
        onToggleSidebar={mockToggle}
      />
    );

    const collapseButton = screen.getByLabelText('Collapse sidebar');
    expect(collapseButton).toBeInTheDocument();

    fireEvent.click(collapseButton);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('does not show collapse button when onToggleSidebar is not provided', () => {
    render(
      <ProjectSidebar
        selectedProject={null}
        onSelectProject={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
  });

  it('renders login area at the bottom', () => {
    render(
      <ProjectSidebar
        selectedProject={null}
        onSelectProject={vi.fn()}
      />
    );

    expect(screen.getByTestId('login-area')).toBeInTheDocument();
  });

  it('shows new project button', () => {
    render(
      <ProjectSidebar
        selectedProject={null}
        onSelectProject={vi.fn()}
      />
    );

    expect(screen.getByText('New Project')).toBeInTheDocument();
  });
});