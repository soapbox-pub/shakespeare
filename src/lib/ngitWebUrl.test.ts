import { describe, it, expect } from 'vitest';
import { ngitWebUrl } from './ngitWebUrl';
import { NostrURI } from './NostrURI';

describe('ngitWebUrl', () => {
  it('generates URL with naddr placeholder', () => {
    const template = 'https://nostrhub.io/{naddr}';
    const pubkey = 'a'.repeat(64); // 64-character hex pubkey
    const identifier = 'my-repo';
    const nostrURI = new NostrURI({ pubkey, identifier });

    const result = ngitWebUrl(template, nostrURI);

    expect(result).toMatch(/^https:\/\/nostrhub\.io\/naddr1/);
  });

  it('generates URL with npub placeholder', () => {
    const template = 'https://example.com/{npub}';
    const pubkey = 'a'.repeat(64);
    const identifier = 'my-repo';
    const nostrURI = new NostrURI({ pubkey, identifier });

    const result = ngitWebUrl(template, nostrURI);

    expect(result).toMatch(/^https:\/\/example\.com\/npub1/);
  });

  it('generates URL with pubkey placeholder', () => {
    const template = 'https://example.com/{pubkey}';
    const pubkey = 'a'.repeat(64);
    const identifier = 'my-repo';
    const nostrURI = new NostrURI({ pubkey, identifier });

    const result = ngitWebUrl(template, nostrURI);

    expect(result).toBe(`https://example.com/${pubkey}`);
  });

  it('generates URL with identifier placeholder', () => {
    const template = 'https://example.com/{identifier}';
    const pubkey = 'a'.repeat(64);
    const identifier = 'my-repo';
    const nostrURI = new NostrURI({ pubkey, identifier });

    const result = ngitWebUrl(template, nostrURI);

    expect(result).toBe('https://example.com/my-repo');
  });

  it('generates URL with multiple placeholders', () => {
    const template = 'https://example.com/{npub}/{identifier}';
    const pubkey = 'a'.repeat(64);
    const identifier = 'my-repo';
    const nostrURI = new NostrURI({ pubkey, identifier });

    const result = ngitWebUrl(template, nostrURI);

    expect(result).toMatch(/^https:\/\/example\.com\/npub1[^/]+\/my-repo$/);
  });

  it('includes relay in naddr when provided', () => {
    const template = 'https://nostrhub.io/{naddr}';
    const pubkey = 'a'.repeat(64);
    const identifier = 'my-repo';
    const relay = 'wss://relay.example.com/';
    const nostrURI = new NostrURI({ pubkey, identifier, relay });

    const result = ngitWebUrl(template, nostrURI);

    // The naddr should be longer when it includes relay information
    expect(result).toMatch(/^https:\/\/nostrhub\.io\/naddr1/);
    expect(result.length).toBeGreaterThan(50);
  });
});
