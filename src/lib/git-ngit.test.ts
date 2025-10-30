import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { getNgitServers } from './git';

// Valid test npub for GRASP URL testing
const TEST_NPUB = 'npub1cmzxsdtwlu5m42vmqrkkcx50pc7anr5754ncmn380gmf4gcjsgms7vk7pj';

// Helper to create a mock repository announcement event
function createRepoEvent(tags: string[][]): NostrEvent {
  return {
    id: 'test-id',
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 30617,
    tags,
    content: '',
    sig: 'test-sig',
  };
}

describe('getNgitServers', () => {
  it('should identify GRASP servers from clone and relays tags (NIP-34 format)', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`, `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy/', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
    expect(servers).toHaveLength(2);
  });

  it('should identify GRASP servers from clone and relays tags (multiple tags format)', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy/'],
      ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
    expect(servers).toHaveLength(2);
  });

  it('should require both clone and relays tags to identify GRASP server', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      // Missing relays tag for git.shakespeare.diy
      ['relays', 'wss://relay.ngit.dev/'],
      // Missing clone tag for relay.ngit.dev
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual([]);
  });

  it('should validate npub pattern in clone URLs', () => {
    const event = createRepoEvent([
      ['clone', 'https://git.shakespeare.diy/invalid-npub/myrepo.git'],
      ['relays', 'wss://git.shakespeare.diy/'],
      ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['relay.ngit.dev']);
  });

  it('should require .git extension in clone URLs', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo`],
      ['relays', 'wss://git.shakespeare.diy/'],
      ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['relay.ngit.dev']);
  });

  it('should handle multiple clone URLs for same server', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/repo1.git`],
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/repo2.git`],
      ['relays', 'wss://git.shakespeare.diy/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should handle http and https protocols', () => {
    const event = createRepoEvent([
      ['clone', `http://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy/'],
      ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
    expect(servers).toHaveLength(2);
  });

  it('should handle ws and wss protocols', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      ['relays', 'ws://git.shakespeare.diy/'],
      ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
    expect(servers).toHaveLength(2);
  });

  it('should ignore non-GRASP clone URLs (separate tags)', () => {
    const event = createRepoEvent([
      ['clone', 'https://github.com/user/repo.git'],
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should ignore non-GRASP clone URLs (mixed in single tag)', () => {
    const event = createRepoEvent([
      ['clone', 'https://github.com/user/repo.git', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`, 'https://gitlab.com/user/repo.git'],
      ['relays', 'wss://git.shakespeare.diy/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should return empty array when no GRASP servers found', () => {
    const event = createRepoEvent([
      ['clone', 'https://github.com/user/repo.git'],
      ['relays', 'wss://relay.nostr.band/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual([]);
  });

  it('should handle invalid URLs gracefully', () => {
    const event = createRepoEvent([
      ['clone', 'not-a-valid-url'],
      ['relays', 'also-invalid'],
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should handle paths with subdirectories after npub', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/org/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should handle empty tags array', () => {
    const event = createRepoEvent([]);

    const servers = getNgitServers(event);
    expect(servers).toEqual([]);
  });

  it('should handle tags with empty values', () => {
    const event = createRepoEvent([
      ['clone', ''],
      ['relays', ''],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual([]);
  });

  it('should handle clone URLs with trailing slashes', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git/`],
      ['relays', 'wss://git.shakespeare.diy/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should handle relay URLs without trailing slashes', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(['git.shakespeare.diy']);
  });

  it('should handle mixed trailing slashes in clone and relay URLs', () => {
    const event = createRepoEvent([
      ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git/`, `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
      ['relays', 'wss://git.shakespeare.diy', 'wss://relay.ngit.dev/'],
    ]);

    const servers = getNgitServers(event);
    expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
    expect(servers).toHaveLength(2);
  });
});
