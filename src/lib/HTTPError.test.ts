import { describe, it, expect } from 'vitest';

import { HTTPError } from './HTTPError.ts';

describe('HTTPError', () => {
  it('should create HTTPError with correct properties', () => {
    const request = new Request('https://example.com/api');
    const response = new Response('Not Found', { status: 404 });

    const error = new HTTPError(response, request);

    expect(error.name).toBe('HTTPError');
    expect(error.message).toBe('HTTP Error: 404 GET https://example.com/api');
    expect(error.response).toBe(response);
    expect(error.request).toBe(request);
  });
});
