import { describe, it, expect } from 'vitest';

import { NostrbookClient } from './NostrbookClient.ts';

describe('NostrbookClient', () => {
  const mockFetch: typeof fetch = async (input, init) => {
    const { url } = new Request(input, init);
    switch (url) {
      case 'https://nostrbook.test/kinds/1.md':
        return new Response('Kind: 1');
      case 'https://nostrbook.test/tags/p.md':
        return new Response('Tag: p');
      case 'https://nostrbook.test/protocol/relay.md':
        return new Response('Protocol: relay');
      default:
        return new Response('Not Found', { status: 404 });
    }
  };

  const client = new NostrbookClient({
    baseUrl: 'https://nostrbook.test',
    fetch: mockFetch,
  });

  it('should read kind document', async () => {
    const doc = await client.readKind(1);
    expect(doc).toBe('Kind: 1');
  });

  it('should read tag document', async () => {
    const doc = await client.readTag('p');
    expect(doc).toBe('Tag: p');
  });

  it('should read protocol document', async () => {
    const doc = await client.readProtocol('relay');
    expect(doc).toBe('Protocol: relay');
  });

  it('should throw HTTPError for 404 responses', async () => {
    await expect(client.readKind(999)).rejects.toMatchObject({
      name: 'HTTPError',
      message: 'HTTP Error: 404 GET https://nostrbook.test/kinds/999.md',
    });
  });
});
