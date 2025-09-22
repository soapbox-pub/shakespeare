import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurlCommand } from './curl';
import type { JSRuntimeFS } from '../JSRuntime';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock filesystem
const mockFS: JSRuntimeFS = {
  writeFile: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  lstat: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  rmdir: vi.fn(),
  unlink: vi.fn(),
  rename: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
};

describe('CurlCommand', () => {
  let curlCommand: CurlCommand;

  beforeEach(() => {
    curlCommand = new CurlCommand(mockFS);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should have correct name and description', () => {
    expect(curlCommand.name).toBe('curl');
    expect(curlCommand.description).toBe('Transfer data from or to a server using HTTP/HTTPS');
    expect(curlCommand.usage).toBe('curl [options] <url>');
  });

  it('should return error when no URL is provided', async () => {
    const result = await curlCommand.execute([], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('no URL specified');
  });

  it('should return error for invalid URL', async () => {
    const result = await curlCommand.execute(['invalid-url'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('invalid URL');
  });

  it('should return error for unsupported protocol', async () => {
    const result = await curlCommand.execute(['ftp://example.com'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('unsupported protocol');
  });

  it('should make a basic GET request', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('Hello World'),
      headers: new Map([['content-type', 'text/plain']]),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute(['https://example.com'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Hello World');
    expect(mockFetch).toHaveBeenCalledWith('https://proxy.shakespeare.diy/?url=https%3A%2F%2Fexample.com%2F', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        'User-Agent': 'curl/8.0.0 (compatible; JavaScript fetch)'
      })
    }));
  });

  it('should handle POST request with data', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com/api',
      text: vi.fn().mockResolvedValue('{"success": true}'),
      headers: new Map([['content-type', 'application/json']]),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute([
      '-d', '{"name": "test"}',
      'https://example.com/api'
    ], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{"success": true}');
    expect(mockFetch).toHaveBeenCalledWith('https://proxy.shakespeare.diy/?url=https%3A%2F%2Fexample.com%2Fapi', expect.objectContaining({
      method: 'POST',
      body: '{"name": "test"}',
      headers: expect.objectContaining({
        'Content-Type': 'application/x-www-form-urlencoded'
      })
    }));
  });

  it('should handle custom headers', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('OK'),
      headers: new Map(),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute([
      '-H', 'Authorization: Bearer token123',
      '-H', 'Content-Type: application/json',
      'https://example.com'
    ], '/test');

    expect(result.exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith('https://proxy.shakespeare.diy/?url=https%3A%2F%2Fexample.com%2F', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer token123',
        'Content-Type': 'application/json',
        'User-Agent': 'curl/8.0.0 (compatible; JavaScript fetch)'
      })
    }));
  });

  it('should include response headers when -i flag is used', async () => {
    const mockHeaders = new Map([
      ['content-type', 'text/plain'],
      ['content-length', '11']
    ]);
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('Hello World'),
      headers: mockHeaders,
      redirected: false,
    };
    mockResponse.headers.forEach = vi.fn((callback) => {
      callback('text/plain', 'content-type');
      callback('11', 'content-length');
    });
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute(['-i', 'https://example.com'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('HTTP/1.1 200 OK');
    expect(result.stdout).toContain('content-type: text/plain');
    expect(result.stdout).toContain('Hello World');
  });

  it('should save output to file when -o flag is used', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('File content'),
      headers: new Map(),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute([
      '-o', 'output.txt',
      'https://example.com'
    ], '/test');

    expect(result.exitCode).toBe(0);
    expect(mockFS.writeFile).toHaveBeenCalledWith('/test/output.txt', 'File content', 'utf8');
    expect(result.stdout).toContain('100  12  100  12');
  });

  it('should be silent when -s flag is used', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('Hello World'),
      headers: new Map(),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute(['-s', 'https://example.com'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('should handle HTTP error responses', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      url: 'https://example.com/notfound',
      text: vi.fn().mockResolvedValue('Page not found'),
      headers: new Map(),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute(['https://example.com/notfound'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('HTTP 404: Not Found');
    expect(result.stderr).toContain('Page not found');
  });

  it('should handle custom method with -X flag', async () => {
    const mockResponse = {
      ok: true,
      status: 204,
      statusText: 'No Content',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue(''),
      headers: new Map(),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute([
      '-X', 'DELETE',
      'https://example.com'
    ], '/test');

    expect(result.exitCode).toBe(0);
    expect(mockFetch).toHaveBeenCalledWith('https://proxy.shakespeare.diy/?url=https%3A%2F%2Fexample.com%2F', expect.objectContaining({
      method: 'DELETE',
      headers: expect.objectContaining({
        'User-Agent': 'curl/8.0.0 (compatible; JavaScript fetch)'
      })
    }));
  });

  it('should handle combined short flags', async () => {
    const mockHeaders = new Map([['content-type', 'text/plain']]);
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('Hello World'),
      headers: mockHeaders,
      redirected: false,
    };
    mockResponse.headers.forEach = vi.fn((callback) => {
      callback('text/plain', 'content-type');
    });
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute(['-si', 'https://example.com'], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(''); // Silent mode
  });

  it('should handle write-out format', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      url: 'https://example.com',
      text: vi.fn().mockResolvedValue('Hello World'),
      headers: new Map([['content-type', 'text/plain']]),
      redirected: false,
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await curlCommand.execute([
      '-w', '%{http_code}\\n',
      'https://example.com'
    ], '/test');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello World');
    expect(result.stdout).toContain('200');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await curlCommand.execute(['https://example.com'], '/test');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Network error');
  });

  it('should handle timeout', async () => {
    vi.useFakeTimers();

    const mockController = {
      abort: vi.fn(),
      signal: { aborted: false }
    };
    global.AbortController = vi.fn(() => mockController) as unknown as typeof AbortController;

    // Mock fetch to reject with AbortError after timeout
    mockFetch.mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('This operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }, 1100); // Slightly longer than timeout
      });
    });

    const promise = curlCommand.execute(['-m', '1', 'https://example.com'], '/test');

    // Fast-forward time to trigger timeout
    vi.advanceTimersByTime(1100);

    const result = await promise;

    expect(mockController.abort).toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('operation timed out after 1 seconds');

    vi.useRealTimers();
  });
});