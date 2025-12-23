import { describe, it, expect } from 'vitest';
import { nip19 } from 'nostr-tools';
import { NostrURI } from './NostrURI';

describe('NostrURI', () => {
  const testPubkey = 'a'.repeat(64); // Valid hex pubkey
  const testNpub = nip19.npubEncode(testPubkey);
  const testIdentifier = 'my-repo';
  const testRelay = 'wss://relay.example.com/';

  describe('constructor', () => {
    it('creates a NostrURI from parts without relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
      });

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBeUndefined();
    });

    it('creates a NostrURI from parts with relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: testRelay,
      });

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBe(testRelay);
    });
  });

  describe('parse', () => {
    it('parses a simple nostr URI without relay', async () => {
      const uriString = `nostr://${testNpub}/${testIdentifier}`;
      const uri = await NostrURI.parse(uriString);

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBeUndefined();
    });

    it('parses a nostr URI with relay', async () => {
      const uriString = `nostr://${testNpub}/relay.example.com/${testIdentifier}`;
      const uri = await NostrURI.parse(uriString);

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBe('wss://relay.example.com/');
    });

    it('parses a nostr URI with wss:// relay', async () => {
      const uriString = `nostr://${testNpub}/wss://relay.example.com/${testIdentifier}`;
      const uri = await NostrURI.parse(uriString);

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBe('wss://relay.example.com/');
    });

    it('throws on invalid URI prefix', async () => {
      await expect(NostrURI.parse('https://example.com')).rejects.toThrow(
        'Invalid Nostr URI: must start with "nostr://"'
      );
    });

    it('throws on too few path segments', async () => {
      await expect(NostrURI.parse('nostr://npub1abc')).rejects.toThrow(
        'Invalid Nostr URI: must have at least pubkey/identifier'
      );
    });

    it('throws on too many path segments', async () => {
      await expect(
        NostrURI.parse(`nostr://${testNpub}/relay/identifier/extra`)
      ).rejects.toThrow('Invalid Nostr URI: too many path segments');
    });

    it('throws on invalid npub', async () => {
      await expect(NostrURI.parse('nostr://invalid/identifier')).rejects.toThrow(
        'Invalid Nostr URI: identifier must be npub or NIP-05 address'
      );
    });
  });

  describe('toString', () => {
    it('converts to string without relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
      });

      const str = uri.toString();
      expect(str).toBe(`nostr://${testNpub}/${testIdentifier}`);
    });

    it('converts to string with relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: testRelay,
      });

      const str = uri.toString();
      expect(str).toBe(`nostr://${testNpub}/relay.example.com/${testIdentifier}`);
    });

    it('removes wss:// prefix and trailing slash from relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: 'wss://relay.example.com/',
      });

      const str = uri.toString();
      expect(str).toBe(`nostr://${testNpub}/relay.example.com/${testIdentifier}`);
    });
  });

  describe('toNaddr', () => {
    it('converts to naddr without relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
      });

      const naddr = uri.toNaddr(30617);
      const decoded = nip19.decode(naddr);

      expect(decoded.type).toBe('naddr');
      if (decoded.type === 'naddr') {
        expect(decoded.data.pubkey).toBe(testPubkey);
        expect(decoded.data.identifier).toBe(testIdentifier);
        expect(decoded.data.kind).toBe(30617);
        // nip19.naddrEncode returns an empty array when no relays are provided
        expect(decoded.data.relays).toEqual([]);
      }
    });

    it('converts to naddr with relay', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: testRelay,
      });

      const naddr = uri.toNaddr(30617);
      const decoded = nip19.decode(naddr);

      expect(decoded.type).toBe('naddr');
      if (decoded.type === 'naddr') {
        expect(decoded.data.pubkey).toBe(testPubkey);
        expect(decoded.data.identifier).toBe(testIdentifier);
        expect(decoded.data.kind).toBe(30617);
        expect(decoded.data.relays).toEqual([testRelay]);
      }
    });

    it('uses default kind 30617 when not specified', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
      });

      const naddr = uri.toNaddr();
      const decoded = nip19.decode(naddr);

      expect(decoded.type).toBe('naddr');
      if (decoded.type === 'naddr') {
        expect(decoded.data.kind).toBe(30617);
      }
    });
  });

  describe('fromNaddr', () => {
    it('creates NostrURI from naddr without relay', () => {
      const naddr = nip19.naddrEncode({
        kind: 30617,
        pubkey: testPubkey,
        identifier: testIdentifier,
      });

      const uri = NostrURI.fromNaddr(naddr);

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBeUndefined();
    });

    it('creates NostrURI from naddr with relay', () => {
      const naddr = nip19.naddrEncode({
        kind: 30617,
        pubkey: testPubkey,
        identifier: testIdentifier,
        relays: [testRelay],
      });

      const uri = NostrURI.fromNaddr(naddr);

      expect(uri.pubkey).toBe(testPubkey);
      expect(uri.identifier).toBe(testIdentifier);
      expect(uri.relay).toBe(testRelay);
    });

    it('uses first relay when multiple relays provided', () => {
      const naddr = nip19.naddrEncode({
        kind: 30617,
        pubkey: testPubkey,
        identifier: testIdentifier,
        relays: [testRelay, 'wss://another-relay.com/'],
      });

      const uri = NostrURI.fromNaddr(naddr);

      expect(uri.relay).toBe(testRelay);
    });

    it('throws on invalid naddr', () => {
      expect(() => NostrURI.fromNaddr('invalid')).toThrow('Failed to parse naddr');
    });

    it('throws on non-naddr identifier', () => {
      const npub = nip19.npubEncode(testPubkey);
      expect(() => NostrURI.fromNaddr(npub)).toThrow(
        'Invalid naddr: must be an addressable event pointer'
      );
    });
  });

  describe('toJSON', () => {
    it('returns the component parts', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: testRelay,
      });

      const parts = uri.toJSON();

      expect(parts).toEqual({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: testRelay,
      });
    });
  });

  describe('round-trip conversions', () => {
    it('parse -> toString round-trip works', async () => {
      const original = `nostr://${testNpub}/${testIdentifier}`;
      const uri = await NostrURI.parse(original);
      const result = uri.toString();

      expect(result).toBe(original);
    });

    it('parse -> toString round-trip works with relay', async () => {
      const original = `nostr://${testNpub}/relay.example.com/${testIdentifier}`;
      const uri = await NostrURI.parse(original);
      const result = uri.toString();

      expect(result).toBe(original);
    });

    it('toNaddr -> fromNaddr round-trip works', () => {
      const uri = new NostrURI({
        pubkey: testPubkey,
        identifier: testIdentifier,
        relay: testRelay,
      });

      const naddr = uri.toNaddr(30617);
      const result = NostrURI.fromNaddr(naddr);

      expect(result.pubkey).toBe(uri.pubkey);
      expect(result.identifier).toBe(uri.identifier);
      expect(result.relay).toBe(uri.relay);
    });
  });
});
