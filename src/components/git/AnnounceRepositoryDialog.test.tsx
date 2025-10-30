import { describe, it, expect } from 'vitest';

describe('AnnounceRepositoryDialog - NIP-34 Tag Structure', () => {
  it('should create tags with multiple values in single tag per NIP-34', () => {
    // Test the tag structure that would be created
    const webUrls = ['https://example.com/browse', 'https://mirror.example.com'];
    const cloneUrls = [
      'https://git.shakespeare.diy/npub1.../repo.git',
      'https://relay.ngit.dev/npub1.../repo.git',
    ];
    const relays = ['wss://git.shakespeare.diy', 'wss://relay.ngit.dev'];

    const tags: string[][] = [['d', 'test-repo']];

    // Simulate the tag creation logic from AnnounceRepositoryDialog
    if (webUrls.length > 0) {
      const trimmedUrls = webUrls.map((url) => url.trim()).filter((url) => url);
      if (trimmedUrls.length > 0) {
        tags.push(['web', ...trimmedUrls]);
      }
    }

    if (cloneUrls.length > 0) {
      const trimmedUrls = cloneUrls.map((url) => url.trim()).filter((url) => url);
      if (trimmedUrls.length > 0) {
        tags.push(['clone', ...trimmedUrls]);
      }
    }

    if (relays.length > 0) {
      const trimmedRelays = relays.map((relay) => relay.trim()).filter((relay) => relay);
      if (trimmedRelays.length > 0) {
        tags.push(['relays', ...trimmedRelays]);
      }
    }

    // Verify the structure matches NIP-34 spec
    expect(tags).toEqual([
      ['d', 'test-repo'],
      ['web', 'https://example.com/browse', 'https://mirror.example.com'],
      [
        'clone',
        'https://git.shakespeare.diy/npub1.../repo.git',
        'https://relay.ngit.dev/npub1.../repo.git',
      ],
      ['relays', 'wss://git.shakespeare.diy', 'wss://relay.ngit.dev'],
    ]);

    // Verify we have single tags with multiple values, not multiple tags
    const cloneTags = tags.filter((t) => t[0] === 'clone');
    expect(cloneTags.length).toBe(1);
    expect(cloneTags[0].length).toBe(3); // ['clone', url1, url2]

    const relayTags = tags.filter((t) => t[0] === 'relays');
    expect(relayTags.length).toBe(1);
    expect(relayTags[0].length).toBe(3); // ['relays', relay1, relay2]
  });

  it('should handle reading relays from single tag with multiple values', () => {
    // Simulate the event structure from Nostr
    const repoEvent = {
      tags: [
        ['d', 'hello-shakespeare'],
        [
          'clone',
          'https://git.shakespeare.diy/npub1.../hello-shakespeare.git',
          'https://relay.ngit.dev/npub1.../hello-shakespeare.git',
        ],
        ['relays', 'wss://git.shakespeare.diy', 'wss://relay.ngit.dev'],
      ],
    };

    // Simulate the reading logic from PullRequestDialog
    const relayTag = repoEvent.tags.find((t: string[]) => t[0] === 'relays');
    let publishRelays: string[] = [];

    if (relayTag && relayTag.length > 1) {
      publishRelays = relayTag.slice(1);
    }

    // Verify we extracted all relay URLs correctly
    expect(publishRelays).toEqual(['wss://git.shakespeare.diy', 'wss://relay.ngit.dev']);
  });

  it('should handle reading clone URLs from single tag with multiple values', () => {
    const repoEvent = {
      tags: [
        ['d', 'hello-shakespeare'],
        [
          'clone',
          'https://git.shakespeare.diy/npub1.../hello-shakespeare.git',
          'https://relay.ngit.dev/npub1.../hello-shakespeare.git',
        ],
      ],
    };

    const cloneTag = repoEvent.tags.find((t: string[]) => t[0] === 'clone');
    let cloneUrls: string[] = [];

    if (cloneTag && cloneTag.length > 1) {
      cloneUrls = cloneTag.slice(1);
    }

    expect(cloneUrls).toEqual([
      'https://git.shakespeare.diy/npub1.../hello-shakespeare.git',
      'https://relay.ngit.dev/npub1.../hello-shakespeare.git',
    ]);
  });

  it('should handle reading maintainers from single tag with multiple values', () => {
    const repoEvent = {
      tags: [
        ['d', 'hello-shakespeare'],
        ['maintainers', 'pubkey1', 'pubkey2', 'pubkey3'],
      ],
    };

    // Simulate the reading logic from NostrGitProvider
    const maintainerTag = repoEvent.tags.find((t: string[]) => t[0] === 'maintainers');
    const maintainers = maintainerTag ? maintainerTag.slice(1) : [];

    expect(maintainers).toEqual(['pubkey1', 'pubkey2', 'pubkey3']);
  });
});
