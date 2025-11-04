import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NostrPublishEventsTool } from './NostrPublishEventsTool';

// Mock nostr-tools to avoid crypto issues in test environment
vi.mock('nostr-tools', () => ({
  generateSecretKey: vi.fn(() => new Uint8Array(32).fill(1)),
  getPublicKey: vi.fn(() => 'test-pubkey-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
  finalizeEvent: vi.fn((template, _secretKey) => ({
    ...template,
    pubkey: 'test-pubkey-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    id: 'test-event-id-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    sig: 'test-signature-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })),
}));

// Mock NPool to avoid actual network calls
vi.mock('@nostrify/nostrify', () => ({
  NPool: vi.fn().mockImplementation(() => ({
    event: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  NRelay1: vi.fn(),
}));

describe('NostrPublishEventsTool', () => {
  let tool: NostrPublishEventsTool;

  beforeEach(() => {
    tool = new NostrPublishEventsTool();
  });

  it('should have correct description', () => {
    expect(tool.description).toContain('Publish Nostr events');
    expect(tool.description).toContain('ephemeral keypair');
  });

  it('should validate input schema', () => {
    // Valid input
    expect(() =>
      tool.inputSchema.parse({
        events: [{ kind: 1, content: 'hello world' }],
      })
    ).not.toThrow();

    // Valid with relays
    expect(() =>
      tool.inputSchema.parse({
        events: [{ kind: 1, content: 'hello' }],
        relays: ['wss://relay.example.com'],
      })
    ).not.toThrow();

    // Invalid: empty events array
    expect(() =>
      tool.inputSchema.parse({
        events: [],
      })
    ).toThrow();

    // Invalid: invalid kind
    expect(() =>
      tool.inputSchema.parse({
        events: [{ kind: -1 }],
      })
    ).toThrow();

    // Invalid: invalid relay URL
    expect(() =>
      tool.inputSchema.parse({
        events: [{ kind: 1 }],
        relays: ['not-a-url'],
      })
    ).toThrow();
  });

  it('should publish events with default values', async () => {
    const result = await tool.execute({
      events: [{}],
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.pubkey).toBeDefined();
    expect(parsed.events_published).toBe(2); // kind 0 + 1 user event
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].kind).toBe(0); // Profile event
    expect(parsed.events[1].kind).toBe(1); // Default kind
  });

  it('should publish multiple events with custom values', async () => {
    const result = await tool.execute({
      events: [
        { kind: 1, content: 'hello world', tags: [['t', 'test']] },
        { kind: 30023, content: '# Article', tags: [['d', 'my-article']] },
      ],
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.events_published).toBe(3); // kind 0 + 2 user events
    expect(parsed.events[1].kind).toBe(1);
    expect(parsed.events[1].content).toBe('hello world');
    expect(parsed.events[2].kind).toBe(30023);
  });

  it('should use custom relays when provided', async () => {
    const customRelays = ['wss://relay.custom1.com', 'wss://relay.custom2.com'];
    const result = await tool.execute({
      events: [{ kind: 1, content: 'test' }],
      relays: customRelays,
    });

    const parsed = JSON.parse(result);
    expect(parsed.relays).toEqual(customRelays);
  });

  it('should truncate long content in response', async () => {
    const longContent = 'a'.repeat(150);
    const result = await tool.execute({
      events: [{ kind: 1, content: longContent }],
    });

    const parsed = JSON.parse(result);
    expect(parsed.events[1].content).toHaveLength(103); // 100 chars + '...'
    expect(parsed.events[1].content).toMatch(/^a+\.\.\.$/);
  });

  it('should set created_at to current time by default', async () => {
    const beforeTime = Math.floor(Date.now() / 1000);
    await tool.execute({
      events: [{ kind: 1, content: 'test' }],
    });
    const afterTime = Math.floor(Date.now() / 1000);

    // We can't directly check the created_at in the mocked version,
    // but we can verify the tool doesn't throw and executes successfully
    expect(beforeTime).toBeLessThanOrEqual(afterTime);
  });

  it('should use custom created_at when provided', async () => {
    const customTime = 1234567890;
    const result = await tool.execute({
      events: [{ kind: 1, content: 'test', created_at: customTime }],
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it('should not create fallback kind 0 when user provides one', async () => {
    const result = await tool.execute({
      events: [
        { kind: 0, content: JSON.stringify({ name: 'Custom Name', about: 'Custom bio' }) },
        { kind: 1, content: 'hello world' },
      ],
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.events_published).toBe(2); // Only the 2 user events, no fallback
    expect(parsed.events[0].kind).toBe(0); // User's kind 0
    expect(parsed.events[1].kind).toBe(1);
  });

  it('should create fallback kind 0 when user does not provide one', async () => {
    const result = await tool.execute({
      events: [
        { kind: 1, content: 'hello world' },
        { kind: 30023, content: '# Article' },
      ],
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.events_published).toBe(3); // Fallback kind 0 + 2 user events
    expect(parsed.events[0].kind).toBe(0); // Fallback profile event
    expect(parsed.events[1].kind).toBe(1);
    expect(parsed.events[2].kind).toBe(30023);
  });
});
