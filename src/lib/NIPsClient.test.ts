import { describe, it, expect } from 'vitest';

import { NIPsClient } from './NIPsClient.ts';

describe('NIPsClient', () => {
  const mockFetch: typeof fetch = async (input, init) => {
    const { url } = new Request(input, init);
    switch (url) {
      case 'https://git.test/nostr-protocol/nips/refs/heads/master/01.md':
        return new Response('NIP-01');
      case 'https://git.test/nostr-protocol/nips/refs/heads/master/README.md':
        return new Response('NIPs');
      case 'https://git.test/nostr-protocol/nips/refs/heads/master/BREAKING.md':
        return new Response('Breaking Changes');
      default:
        return new Response('Not Found', { status: 404 });
    }
  };

  const client = new NIPsClient({
    urlTemplate:
      'https://git.test/nostr-protocol/nips/refs/heads/master/{nip}.md',
    fetch: mockFetch,
  });

  it('should read NIP document', async () => {
    const doc = await client.readNip('01');
    expect(doc).toBe('NIP-01');
  });

  it('should read index document', async () => {
    const doc = await client.readIndex();
    expect(doc).toBe('NIPs');
  });

  it('should read breaking changes document', async () => {
    const doc = await client.readBreaking();
    expect(doc).toBe('Breaking Changes');
  });

  it('should throw HTTPError for 404 responses', async () => {
    await expect(client.readNip('abc')).rejects.toMatchObject({
      name: 'HTTPError',
      message: 'HTTP Error: 404 GET https://git.test/nostr-protocol/nips/refs/heads/master/abc.md',
    });
  });
});
