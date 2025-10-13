import { render } from '@testing-library/react';
import { test, expect } from 'vitest';

import App from './App';

test('App', () => {
  const { container } = render(<App />);

  // Basic smoke test to ensure App renders without crashing
  expect(container).toBeInTheDocument();
})