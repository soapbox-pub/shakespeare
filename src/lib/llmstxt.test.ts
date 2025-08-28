import { describe, it, expect } from 'vitest';

import { llmstxtUrl } from './llmstxt.ts';

describe('llmstxtUrl', () => {
  it('should convert URLs to llmstxt format correctly', () => {
    const testCases = [
      {
        input: 'https://example.com',
        expected: 'https://example.com/index.md',
      },
      {
        input: 'https://example.com/',
        expected: 'https://example.com/index.md',
      },
      {
        input: 'https://example.com/test',
        expected: 'https://example.com/test.md',
      },
      {
        input: 'https://example.com/test/',
        expected: 'https://example.com/test/index.md',
      },
      {
        input: 'https://example.com/test.md',
        expected: 'https://example.com/test.md',
      },
    ];

    for (const { input, expected } of testCases) {
      const result = llmstxtUrl(input);
      expect(result.toString()).toBe(expected);
    }
  });
});
