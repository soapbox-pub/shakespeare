import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { Act1Dialog } from './Act1Dialog';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window.open
Object.defineProperty(window, 'open', {
  value: vi.fn(),
});

describe('Act1Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders welcome step correctly', () => {
    render(
      <TestApp>
        <Act1Dialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    expect(screen.getByText(/Welcome to Shakespeare: Act 2!/)).toBeInTheDocument();
    expect(screen.getByText('Welcome to Act 2!')).toBeInTheDocument();
    expect(screen.getByText("What's Changed")).toBeInTheDocument();
    expect(screen.getByText('Enhanced AI Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Improved Git Integration')).toBeInTheDocument();
    expect(screen.getByText('Project Import/Export')).toBeInTheDocument();
    expect(screen.getByText('Act 2 is in Development')).toBeInTheDocument();
    expect(screen.getByText('Configure Act 2')).toBeInTheDocument();
  });

  it('navigates to migration step when Configure Act 2 is clicked', async () => {
    render(
      <TestApp>
        <Act1Dialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    const configureButton = screen.getByText('Configure Act 2');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Migrating Your Projects')).toBeInTheDocument();
    });

    expect(screen.getByText('Your Act 1 Projects & Credits')).toBeInTheDocument();
    expect(screen.getByText('Access Act 1')).toBeInTheDocument();
    expect(screen.getByText('Export from Act 1')).toBeInTheDocument();
    expect(screen.getByText('Import to Act 2')).toBeInTheDocument();
    expect(screen.getByText('Your Credits')).toBeInTheDocument();
  });

  it('navigates to conclusion step when Continue is clicked', async () => {
    render(
      <TestApp>
        <Act1Dialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // Navigate to migration step first
    const configureButton = screen.getByText('Configure Act 2');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    // Click continue to go to conclusion
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Start Building in Act 2')).toBeInTheDocument();
    });

    expect(screen.getByText('Remember: You can always access Act 1 at')).toBeInTheDocument();
  });

  it('opens Act 1 in new tab when Visit Act 1 is clicked', async () => {
    render(
      <TestApp>
        <Act1Dialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // Navigate to migration step
    const configureButton = screen.getByText('Configure Act 2');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Visit Act 1')).toBeInTheDocument();
    });

    const visitAct1Button = screen.getByText('Visit Act 1');
    fireEvent.click(visitAct1Button);

    expect(window.open).toHaveBeenCalledWith('https://act1.shakespeare.diy', '_blank');
  });

  it('removes selectedNSPAddr from localStorage when dialog is finished', async () => {
    const onOpenChange = vi.fn();

    render(
      <TestApp>
        <Act1Dialog open={true} onOpenChange={onOpenChange} />
      </TestApp>
    );

    // Navigate through all steps to conclusion
    const configureButton = screen.getByText('Configure Act 2');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Start Building in Act 2')).toBeInTheDocument();
    });

    const finishButton = screen.getByText('Start Building in Act 2');
    fireEvent.click(finishButton);

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('selectedNSPAddr');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('allows navigation back through steps', async () => {
    render(
      <TestApp>
        <Act1Dialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // Go to migration step
    const configureButton = screen.getByText('Configure Act 2');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Migrating Your Projects')).toBeInTheDocument();
    });

    // Go to conclusion step
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Start Building in Act 2')).toBeInTheDocument();
    });

    // Go back to migration step
    const backButtons = screen.getAllByRole('button');
    const backButton = backButtons.find(button =>
      button.querySelector('svg') && button.getAttribute('class')?.includes('ghost')
    );

    if (backButton) {
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Migrating Your Projects')).toBeInTheDocument();
      });
    }
  });
});