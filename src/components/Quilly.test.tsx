import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Quilly } from './Quilly';
import { MalformedToolCallError } from '@/lib/errors/MalformedToolCallError';
import { ProjectPreviewConsoleError } from '@/lib/tools/ReadConsoleMessagesTool';

// Mock all required hooks and components
vi.mock('@/hooks/useAISettings', () => ({
	useAISettings: () => ({
		settings: {
			providers: []
		}
	})
}));

vi.mock('@/hooks/useAICredits', () => ({
	useAICredits: () => ({
		data: null
	})
}));

vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn()
}));

// Mock CreditsDialog to avoid NostrProvider dependency
vi.mock('./CreditsDialog', () => ({
	CreditsDialog: () => null
}));

describe('Quilly', () => {
	const defaultProps = {
		error: new Error('Generic error'),
		onDismiss: vi.fn(),
		onNewChat: vi.fn(),
		onOpenModelSelector: vi.fn(),
		providerModel: 'test/model'
	};

	it('renders generic error message', () => {
		render(<Quilly {...defaultProps} />);

		expect(screen.getByText(/AI service error: Generic error/)).toBeInTheDocument();
	});

	it('renders correctly for malformed tool call errors', () => {
		const error = new MalformedToolCallError(
			'The AI provider sent an incomplete response.',
			'call_abc123',
			'test/model'
		);

		render(
			<Quilly
				{...defaultProps}
				error={error}
			/>
		);

		expect(screen.getByText(/The AI sent an incomplete response/)).toBeInTheDocument();
		expect(screen.getByText(/Change model/)).toBeInTheDocument();
	});

	it('renders correctly for console errors', () => {
		const error = new ProjectPreviewConsoleError(
			'Console error',
			[]
		);

		render(
			<Quilly
				{...defaultProps}
				error={error}
			/>
		);

		expect(screen.getByText(/I noticed some console errors/)).toBeInTheDocument();
		expect(screen.getByText(/Help fix errors/)).toBeInTheDocument();
	});
});
