import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CapacitorFSAdapter } from './CapacitorFSAdapter';
import * as Filesystem from '@capacitor/filesystem';

// Mock Capacitor Filesystem
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    deleteFile: vi.fn(),
    rmdir: vi.fn(),
    rename: vi.fn(),
  },
  Directory: {
    Data: 'DATA',
  },
  Encoding: {
    UTF8: 'utf8',
  },
}));

describe('CapacitorFSAdapter', () => {
  let adapter: CapacitorFSAdapter;

  beforeEach(() => {
    adapter = new CapacitorFSAdapter();
    vi.clearAllMocks();
  });

  describe('readFile', () => {
    it('should read text file with utf8 encoding', async () => {
      vi.mocked(Filesystem.Filesystem.readFile).mockResolvedValue({
        data: 'hello world',
      });

      const result = await adapter.readFile('/test.txt', 'utf8');

      expect(result).toBe('hello world');
      expect(Filesystem.Filesystem.readFile).toHaveBeenCalledWith({
        path: 'test.txt',
        directory: 'DATA',
        encoding: 'utf8',
      });
    });

    it('should read binary file and convert from base64', async () => {
      // Binary data returned as base64 when no encoding specified
      vi.mocked(Filesystem.Filesystem.readFile).mockResolvedValue({
        data: 'aGVsbG8=', // 'hello' in base64
      });

      const result = await adapter.readFile('/test.bin');

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result as Uint8Array)).toEqual([104, 101, 108, 108, 111]);
      expect(Filesystem.Filesystem.readFile).toHaveBeenCalledWith({
        path: 'test.bin',
        directory: 'DATA',
      });
    });

    it('should throw error for non-existent file', async () => {
      vi.mocked(Filesystem.Filesystem.readFile).mockRejectedValue(
        new Error('File not found')
      );

      await expect(adapter.readFile('/missing.txt')).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('should write text file with utf8 encoding', async () => {
      vi.mocked(Filesystem.Filesystem.writeFile).mockResolvedValue({ uri: '' });

      await adapter.writeFile('/test.txt', 'hello world', 'utf8');

      expect(Filesystem.Filesystem.writeFile).toHaveBeenCalledWith({
        path: 'test.txt',
        directory: 'DATA',
        data: 'hello world',
        encoding: 'utf8',
      });
    });

    it('should write binary file as base64', async () => {
      vi.mocked(Filesystem.Filesystem.writeFile).mockResolvedValue({ uri: '' });

      const data = new Uint8Array([104, 101, 108, 108, 111]); // 'hello'
      await adapter.writeFile('/test.bin', data);

      expect(Filesystem.Filesystem.writeFile).toHaveBeenCalledWith({
        path: 'test.bin',
        directory: 'DATA',
        data: 'aGVsbG8=', // base64 encoded
      });
    });

    it('should normalize paths and remove trailing slashes', async () => {
      vi.mocked(Filesystem.Filesystem.writeFile).mockResolvedValue({ uri: '' });

      const data = new Uint8Array([104, 101, 108, 108, 111]);
      await adapter.writeFile('/test.bin/', data); // Note the trailing slash

      expect(Filesystem.Filesystem.writeFile).toHaveBeenCalledWith({
        path: 'test.bin', // Trailing slash should be removed
        directory: 'DATA',
        data: 'aGVsbG8=', // base64 encoded
      });
    });
  });

  describe('readdir', () => {
    it('should list directory contents', async () => {
      vi.mocked(Filesystem.Filesystem.readdir).mockResolvedValue({
        files: [
          { name: 'file1.txt', type: 'file', size: 100, ctime: 0, mtime: 0, uri: '' },
          { name: 'file2.txt', type: 'file', size: 200, ctime: 0, mtime: 0, uri: '' },
        ],
      });

      const result = await adapter.readdir('/test');

      expect(result).toEqual(['file1.txt', 'file2.txt']);
    });

    it('should list directory with file types', async () => {
      vi.mocked(Filesystem.Filesystem.readdir).mockResolvedValue({
        files: [
          { name: 'file.txt', type: 'file', size: 100, ctime: 0, mtime: 0, uri: '' },
          { name: 'subdir', type: 'directory', size: 0, ctime: 0, mtime: 0, uri: '' },
        ],
      });

      vi.mocked(Filesystem.Filesystem.stat)
        .mockResolvedValueOnce({
          type: 'file',
          size: 100,
          ctime: 0,
          mtime: 0,
          uri: '',
          name: 'file.txt',
        })
        .mockResolvedValueOnce({
          type: 'directory',
          size: 0,
          ctime: 0,
          mtime: 0,
          uri: '',
          name: 'subdir',
        });

      const result = await adapter.readdir('/test', { withFileTypes: true });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('file.txt');
      expect(result[0].isFile()).toBe(true);
      expect(result[0].isDirectory()).toBe(false);
      expect(result[1].name).toBe('subdir');
      expect(result[1].isFile()).toBe(false);
      expect(result[1].isDirectory()).toBe(true);
    });
  });

  describe('mkdir', () => {
    it('should create directory', async () => {
      vi.mocked(Filesystem.Filesystem.mkdir).mockResolvedValue();

      await adapter.mkdir('/test');

      expect(Filesystem.Filesystem.mkdir).toHaveBeenCalledWith({
        path: 'test',
        directory: 'DATA',
        recursive: true,
      });
    });

    it('should create directory recursively', async () => {
      vi.mocked(Filesystem.Filesystem.mkdir).mockResolvedValue();

      await adapter.mkdir('/test/nested/path', { recursive: true });

      expect(Filesystem.Filesystem.mkdir).toHaveBeenCalledWith({
        path: 'test/nested/path',
        directory: 'DATA',
        recursive: true,
      });
    });

    it('should ignore exists error when recursive', async () => {
      vi.mocked(Filesystem.Filesystem.mkdir).mockRejectedValue(
        new Error('Directory already exists')
      );

      await expect(adapter.mkdir('/test', { recursive: true })).resolves.toBeUndefined();
    });
  });

  describe('stat', () => {
    it('should get file stats', async () => {
      vi.mocked(Filesystem.Filesystem.stat).mockResolvedValue({
        type: 'file',
        size: 1024,
        ctime: 1000,
        mtime: 2000,
        uri: '',
        name: 'test.txt',
      });

      const result = await adapter.stat('/test.txt');

      expect(result.isFile()).toBe(true);
      expect(result.isDirectory()).toBe(false);
      expect(result.size).toBe(1024);
      expect(result.mtimeMs).toBe(2000);
    });

    it('should get directory stats', async () => {
      vi.mocked(Filesystem.Filesystem.stat).mockResolvedValue({
        type: 'directory',
        size: 0,
        ctime: 1000,
        mtime: 2000,
        uri: '',
        name: 'test',
      });

      const result = await adapter.stat('/test');

      expect(result.isFile()).toBe(false);
      expect(result.isDirectory()).toBe(true);
    });
  });

  describe('unlink', () => {
    it('should delete file', async () => {
      vi.mocked(Filesystem.Filesystem.deleteFile).mockResolvedValue(undefined);

      await adapter.unlink('/test.txt');

      expect(Filesystem.Filesystem.deleteFile).toHaveBeenCalledWith({
        path: 'test.txt',
        directory: 'DATA',
      });
    });
  });

  describe('rmdir', () => {
    it('should remove directory', async () => {
      vi.mocked(Filesystem.Filesystem.rmdir).mockResolvedValue(undefined);

      await adapter.rmdir('/test');

      expect(Filesystem.Filesystem.rmdir).toHaveBeenCalledWith({
        path: 'test',
        directory: 'DATA',
        recursive: false,
      });
    });
  });

  describe('rename', () => {
    it('should rename file', async () => {
      vi.mocked(Filesystem.Filesystem.rename).mockResolvedValue(undefined);

      await adapter.rename('/old.txt', '/new.txt');

      expect(Filesystem.Filesystem.rename).toHaveBeenCalledWith({
        from: 'old.txt',
        to: 'new.txt',
        directory: 'DATA',
      });
    });
  });

  describe('symlink operations', () => {
    it('should create symlink by copying file', async () => {
      vi.mocked(Filesystem.Filesystem.readFile).mockResolvedValue({
        data: 'aGVsbG8=', // base64
      });
      vi.mocked(Filesystem.Filesystem.writeFile).mockResolvedValue({ uri: '' });

      await adapter.symlink('/target.txt', '/link.txt');

      expect(Filesystem.Filesystem.readFile).toHaveBeenCalledWith({
        path: 'target.txt',
        directory: 'DATA',
      });

      expect(Filesystem.Filesystem.writeFile).toHaveBeenCalledTimes(2);
      // First call writes the actual file
      // Second call writes the .symlink metadata file
    });

    it('should read symlink target from metadata', async () => {
      vi.mocked(Filesystem.Filesystem.readFile).mockResolvedValue({
        data: '/target.txt',
      });

      const result = await adapter.readlink('/link.txt');

      expect(result).toBe('/target.txt');
      expect(Filesystem.Filesystem.readFile).toHaveBeenCalledWith({
        path: 'link.txt.symlink',
        directory: 'DATA',
        encoding: 'utf8',
      });
    });
  });

  describe('path normalization', () => {
    it('should handle root path', async () => {
      vi.mocked(Filesystem.Filesystem.readdir).mockResolvedValue({
        files: [],
      });

      await adapter.readdir('/');

      expect(Filesystem.Filesystem.readdir).toHaveBeenCalledWith({
        path: '.',
        directory: 'DATA',
      });
    });

    it('should remove leading slash from paths', async () => {
      vi.mocked(Filesystem.Filesystem.stat).mockResolvedValue({
        type: 'file',
        size: 0,
        ctime: 0,
        mtime: 0,
        uri: '',
        name: 'file.txt',
      });

      await adapter.stat('/some/path/file.txt');

      expect(Filesystem.Filesystem.stat).toHaveBeenCalledWith({
        path: 'some/path/file.txt',
        directory: 'DATA',
      });
    });
  });
});
