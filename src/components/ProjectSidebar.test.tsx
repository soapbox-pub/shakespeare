import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectSidebar } from './ProjectSidebar';
import { useProjects } from '@/hooks/useProjects';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { TestApp } from '@/test/TestApp';

// Mock the hooks
vi.mock('@/hooks/useProjects');
vi.mock('@/hooks/useLocalStorage');
vi.mock('@/hooks/useProjectSessionStatus', () => ({
  useProjectSessionStatus: () => ({ hasRunningSessions: false })
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      resetQueries: vi.fn()
    })
  };
});

// Mock window.open for help button test
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true
});

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
      <TestApp>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByAltText('Shakespeare')).toBeInTheDocument();
    expect(screen.getByText('Shakespeare')).toBeInTheDocument();
  });

  it('shows collapse button when onToggleSidebar is provided', () => {
    const mockToggle = vi.fn();

    render(
      <TestApp>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={vi.fn()}
          onToggleSidebar={mockToggle}
        />
      </TestApp>
    );

    const collapseButton = screen.getByLabelText('Collapse sidebar');
    expect(collapseButton).toBeInTheDocument();

    fireEvent.click(collapseButton);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('does not show collapse button when onToggleSidebar is not provided', () => {
    render(
      <TestApp>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.queryByLabelText('Collapse sidebar')).not.toBeInTheDocument();
  });

  it('renders settings and help buttons at the bottom', () => {
    render(
      <TestApp>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
  });

  it('shows new project button', () => {
    render(
      <TestApp>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={vi.fn()}
        />
      </TestApp>
    );

    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('opens help documentation when help button is clicked', () => {
    render(
      <TestApp>
        <ProjectSidebar
          selectedProject={null}
          onSelectProject={vi.fn()}
        />
      </TestApp>
    );

    const helpButton = screen.getByLabelText('Help');
    fireEvent.click(helpButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://soapbox.pub/shakespeare-resources/',
      '_blank'
    );
  });
});