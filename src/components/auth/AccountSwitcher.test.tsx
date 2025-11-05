import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountSwitcher } from './AccountSwitcher';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';

// Mock the hooks
vi.mock('@/hooks/useLoggedInAccounts');
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

const mockUseLoggedInAccounts = vi.mocked(useLoggedInAccounts);

describe('AccountSwitcher', () => {
  it('renders account switcher with dropdown trigger', () => {
    mockUseLoggedInAccounts.mockReturnValue({
      authors: [{
        id: 'user1',
        pubkey: 'pubkey1',
        metadata: { name: 'Test User' }
      }],
      currentUser: {
        id: 'user1',
        pubkey: 'pubkey1',
        metadata: { name: 'Test User' }
      },
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
      isLoading: false
    });

    render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

    // Should show the user's name
    expect(screen.getByText('Test User')).toBeInTheDocument();

    // Should show dropdown trigger button
    expect(screen.getByRole('button')).toBeInTheDocument();
  });



  it('returns null when no current user', () => {
    mockUseLoggedInAccounts.mockReturnValue({
      authors: [],
      currentUser: undefined,
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
      isLoading: false
    });

    const { container } = render(<AccountSwitcher onAddAccountClick={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });
});