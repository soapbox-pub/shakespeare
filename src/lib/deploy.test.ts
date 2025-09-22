import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deployProject } from './deploy';
import type { JSRuntimeFS } from './JSRuntime';
import type { NostrSigner } from '@nostrify/nostrify';

// Mock JSZip
vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      folder: vi.fn().mockReturnValue({
        file: vi.fn(),
      }),
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob()),
    })),
  };
});

// Mock NIP98Client
vi.mock('@nostrify/nostrify', () => ({
  NIP98Client: vi.fn().mockImplementation(() => ({
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    }),
  })),
}));

describe('deployProject', () => {
  let mockFS: JSRuntimeFS;
  let mockSigner: NostrSigner;

  beforeEach(() => {
    mockFS = {
      readFile: vi.fn().mockResolvedValue('mock file content'),
      readdir: vi.fn().mockResolvedValue([]),
    } as JSRuntimeFS;

    mockSigner = {} as NostrSigner;
  });

  it('should construct hostname from projectId and deployServer by default', async () => {
    const result = await deployProject({
      projectId: 'test-project',
      deployServer: 'shakespeare.wtf',
      fs: mockFS,
      projectPath: '/projects/test-project',
      signer: mockSigner,
    });

    expect(result.hostname).toBe('test-project.shakespeare.wtf');
    expect(result.url).toBe('https://test-project.shakespeare.wtf');
  });

  it('should use customHostname when provided', async () => {
    const result = await deployProject({
      projectId: 'test-project',
      deployServer: 'shakespeare.wtf',
      fs: mockFS,
      projectPath: '/projects/test-project',
      signer: mockSigner,
      customHostname: 'my-custom-domain.example.com',
    });

    expect(result.hostname).toBe('my-custom-domain.example.com');
    expect(result.url).toBe('https://my-custom-domain.example.com');
  });

  it('should handle custom subdomain with same deploy server', async () => {
    const result = await deployProject({
      projectId: 'original-id',
      deployServer: 'shakespeare.wtf',
      fs: mockFS,
      projectPath: '/projects/original-id',
      signer: mockSigner,
      customHostname: 'custom-name.shakespeare.wtf',
    });

    expect(result.hostname).toBe('custom-name.shakespeare.wtf');
    expect(result.url).toBe('https://custom-name.shakespeare.wtf');
  });
});