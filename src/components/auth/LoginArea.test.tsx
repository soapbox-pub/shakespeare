import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginArea } from './LoginArea';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';

// Mock the hooks
vi.mock('@/hooks/useLoggedInAccounts');
vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: { relayUrl: 'wss://relay.damus.io' },
    updateConfig: vi.fn(),
    presetRelays: [
      { name: 'Damus', url: 'wss://relay.damus.io' }
    ]
  })
}));

// Mock the components
vi.mock('./AccountSwitcher', () => ({
  AccountSwitcher: ({ onAddAccountClick }: { onAddAccountClick: () => void }) => (
    <div data-testid="account-switcher">
      <button onClick={onAddAccountClick}>Add Account</button>
    </div>
  )
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('@/components/RelaySelector', () => ({
  RelaySelector: ({ className }: { className?: string }) => (
    <div data-testid="relay-selector" className={className}>Relay Selector</div>
  )
}));

vi.mock('./LoginDialog', () => ({
  default: ({ isOpen }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="login-dialog">Login Dialog</div> : null
}));

vi.mock('./SignupDialog', () => ({
  default: ({ isOpen }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="signup-dialog">Signup Dialog</div> : null
}));

const mockUseLoggedInAccounts = vi.mocked(useLoggedInAccounts);

describe('LoginArea', () => {
  it('shows AccountSwitcher when user is logged in', () => {
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

    render(<LoginArea />);

    expect(screen.getByTestId('account-switcher')).toBeInTheDocument();
  });




  it('maintains consistent layout structure whether logged in or not', () => {
    // Test logged out state
    mockUseLoggedInAccounts.mockReturnValue({
      authors: [],
      currentUser: undefined,
      otherUsers: [],
      setLogin: vi.fn(),
      removeLogin: vi.fn(),
      isLoading: false
    });

    const { rerender } = render(<LoginArea />);

    const loggedOutContainer = screen.getByRole('button');
    expect(loggedOutContainer).toHaveClass('flex', 'items-center', 'gap-3', 'p-3', 'rounded-full');

    // Test logged in state
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

    rerender(<LoginArea />);

    // Both states should maintain similar structure
    expect(screen.getByTestId('account-switcher')).toBeInTheDocument();
  });
});