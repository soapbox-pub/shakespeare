import { describe, it, expect } from 'vitest';
import { parseRepositoryAnnouncement } from './announceRepository';
import type { NostrEvent } from '@nostrify/nostrify';
// Valid test npub for GRASP URL testing
const TEST_NPUB = 'npub1cmzxsdtwlu5m42vmqrkkcx50pc7anr5754ncmn380gmf4gcjsgms7vk7pj';


describe('parseRepositoryAnnouncement', () => {
  // Helper to create a mock repository announcement event
  const createMockEvent = (tags: string[][]): NostrEvent => ({
    id: 'test-id',
    pubkey: 'test-pubkey',
    kind: 30617,
    content: '',
    tags,
    created_at: Math.floor(Date.now() / 1000),
    sig: 'test-sig',
  });

  it('should throw error for non-30617 events', () => {
    const event = createMockEvent([]);
    event.kind = 1;

    expect(() => parseRepositoryAnnouncement(event)).toThrow('Expected kind 30617, got 1');
  });

  it('should parse basic repository fields', () => {
    const event = createMockEvent([
      ['d', 'my-repo'],
      ['name', 'My Repository'],
      ['description', 'A test repository'],
      ['clone', 'https://github.com/user/repo.git'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.identifier).toBe('my-repo');
    expect(result.name).toBe('My Repository');
    expect(result.description).toBe('A test repository');
    expect(result.httpsCloneUrls).toEqual(['https://github.com/user/repo.git']);
  });

  it('should handle missing optional fields', () => {
    const event = createMockEvent([
      ['d', 'minimal-repo'],
      ['clone', 'https://example.com/repo.git'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.identifier).toBe('minimal-repo');
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.earliestCommit).toBeUndefined();
    expect(result.maintainers).toEqual([]);
  });

  it('should parse multiple values in single tag (NIP-34 format)', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['web', 'https://example.com', 'https://mirror.example.com'],
      ['clone', 'https://github.com/user/repo.git', 'https://gitlab.com/user/repo.git'],
      ['relays', 'wss://relay1.com', 'wss://relay2.com'],
      ['maintainers', 'pubkey1', 'pubkey2', 'pubkey3'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.webUrls).toEqual(['https://example.com', 'https://mirror.example.com']);
    expect(result.httpsCloneUrls).toEqual([
      'https://github.com/user/repo.git',
      'https://gitlab.com/user/repo.git',
    ]);
    expect(result.relays).toEqual(['wss://relay1.com', 'wss://relay2.com']);
    expect(result.maintainers).toEqual(['pubkey1', 'pubkey2', 'pubkey3']);
  });

  it('should parse multiple separate tags (backward compatibility)', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://github.com/user/repo.git'],
      ['clone', 'https://gitlab.com/user/repo.git'],
      ['relays', 'wss://relay1.com'],
      ['relays', 'wss://relay2.com'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.httpsCloneUrls).toEqual([
      'https://github.com/user/repo.git',
      'https://gitlab.com/user/repo.git',
    ]);
    expect(result.relays).toEqual(['wss://relay1.com', 'wss://relay2.com']);
  });

  it('should extract earliest unique commit (euc)', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://example.com/repo.git'],
      ['r', 'abc123def456', 'euc'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.earliestCommit).toBe('abc123def456');
  });

  it('should ignore r tags without euc marker', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://example.com/repo.git'],
      ['r', 'abc123def456'],
      ['r', 'other-value', 'other-marker'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.earliestCommit).toBeUndefined();
  });

  describe('graspServers - GRASP server detection', () => {
    it('should identify GRASP servers from clone and relays tags (NIP-34 format)', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`, `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy/', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      expect(parsed.graspServers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
      expect(parsed.graspServers).toHaveLength(2);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should identify GRASP servers from clone and relays tags (multiple tags format)', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy/'],
        ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
      expect(servers).toHaveLength(2);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should require both clone and relays tags to identify GRASP server', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        // Missing relays tag for git.shakespeare.diy
        ['relays', 'wss://relay.ngit.dev/'],
        // Missing clone tag for relay.ngit.dev
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual([]);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([`https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`]);
    });

    it('should validate npub pattern in clone URLs', () => {
      const event = createMockEvent([
        ['clone', 'https://git.shakespeare.diy/invalid-npub/myrepo.git'],
        ['relays', 'wss://git.shakespeare.diy/'],
        ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['relay.ngit.dev']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual(['https://git.shakespeare.diy/invalid-npub/myrepo.git']);
    });

    it('should require .git extension in clone URLs', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo`],
        ['relays', 'wss://git.shakespeare.diy/'],
        ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['relay.ngit.dev']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([`https://git.shakespeare.diy/${TEST_NPUB}/myrepo`]);
    });

    it('should handle multiple clone URLs for same server', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/repo1.git`],
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/repo2.git`],
        ['relays', 'wss://git.shakespeare.diy/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should reject http:// clone URLs and only accept https://', () => {
      const event = createMockEvent([
        ['clone', `http://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy/'],
        ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      // Only https://relay.ngit.dev should be identified as GRASP server
      expect(servers).toEqual(['relay.ngit.dev']);
      expect(servers).toHaveLength(1);
      // http:// URL should not be included in httpsCloneUrls at all
      expect(parsed.httpsCloneUrls).toEqual([`https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`]);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle ws and wss protocols', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        ['relays', 'ws://git.shakespeare.diy/'],
        ['clone', `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
      expect(servers).toHaveLength(2);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should ignore non-GRASP clone URLs (separate tags)', () => {
      const event = createMockEvent([
        ['clone', 'https://github.com/user/repo.git'],
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual(['https://github.com/user/repo.git']);
    });

    it('should ignore non-GRASP clone URLs (mixed in single tag)', () => {
      const event = createMockEvent([
        ['clone', 'https://github.com/user/repo.git', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`, 'https://gitlab.com/user/repo.git'],
        ['relays', 'wss://git.shakespeare.diy/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual(['https://github.com/user/repo.git', 'https://gitlab.com/user/repo.git']);
    });

    it('should return empty array when no GRASP servers found', () => {
      const event = createMockEvent([
        ['clone', 'https://github.com/user/repo.git'],
        ['relays', 'wss://relay.nostr.band/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual([]);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual(['https://github.com/user/repo.git']);
    });

    it('should handle invalid URLs gracefully', () => {
      const event = createMockEvent([
        ['clone', 'not-a-valid-url'],
        ['relays', 'also-invalid'],
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle paths with subdirectories after npub', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/org/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle empty tags array', () => {
      const event = createMockEvent([]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual([]);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle tags with empty values', () => {
      const event = createMockEvent([
        ['clone', ''],
        ['relays', ''],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual([]);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle clone URLs with trailing slashes', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git/`],
        ['relays', 'wss://git.shakespeare.diy/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle relay URLs without trailing slashes', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(['git.shakespeare.diy']);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });

    it('should handle mixed trailing slashes in clone and relay URLs', () => {
      const event = createMockEvent([
        ['clone', `https://git.shakespeare.diy/${TEST_NPUB}/myrepo.git/`, `https://relay.ngit.dev/${TEST_NPUB}/myrepo.git`],
        ['relays', 'wss://git.shakespeare.diy', 'wss://relay.ngit.dev/'],
      ]);

      const parsed = parseRepositoryAnnouncement(event);
      const servers = parsed.graspServers;
      expect(servers).toEqual(expect.arrayContaining(['git.shakespeare.diy', 'relay.ngit.dev']));
      expect(servers).toHaveLength(2);
      expect(parsed.nonGraspHttpsCloneUrls).toEqual([]);
    });
  });

  it('should filter out invalid URLs', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://valid.com/repo.git', 'not-a-url', 'ftp://invalid.com/repo.git'],
      ['relays', 'wss://valid.com', 'not-a-url', 'http://invalid.com'],
      ['web', 'https://valid.com', 'not-a-url'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.httpsCloneUrls).toEqual(['https://valid.com/repo.git']);
    expect(result.relays).toEqual(['wss://valid.com']);
    expect(result.webUrls).toEqual(['https://valid.com', 'not-a-url']); // web URLs are not validated
  });

  it('should preserve raw event', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://example.com/repo.git'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.event).toBe(event);
    expect(result.event.id).toBe('test-id');
    expect(result.event.pubkey).toBe('test-pubkey');
  });

  it('should handle empty identifier gracefully', () => {
    const event = createMockEvent([
      ['clone', 'https://example.com/repo.git'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.identifier).toBe('');
  });

  it('should handle empty arrays for missing multi-value tags', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://example.com/repo.git'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.webUrls).toEqual([]);
    expect(result.relays).toEqual([]);
    expect(result.maintainers).toEqual([]);
    expect(result.graspServers).toEqual([]);
    expect(result.nonGraspRelays).toEqual([]);
  });

  it('should accept both ws and wss protocols for relays', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'https://example.com/repo.git'],
      ['relays', 'ws://insecure.example.com', 'wss://secure.example.com'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    expect(result.relays).toEqual([
      'ws://insecure.example.com',
      'wss://secure.example.com',
    ]);
  });

  it('should only accept https:// protocol for clone URLs (reject http://)', () => {
    const event = createMockEvent([
      ['d', 'repo'],
      ['clone', 'http://insecure.example.com/repo.git', 'https://secure.example.com/repo.git'],
    ]);

    const result = parseRepositoryAnnouncement(event);

    // Only https:// URL should be included
    expect(result.httpsCloneUrls).toEqual([
      'https://secure.example.com/repo.git',
    ]);
  });
});
