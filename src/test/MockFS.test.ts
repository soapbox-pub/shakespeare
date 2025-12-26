import { describe, it, expect, beforeEach } from 'vitest';
import { MockFS } from './MockFS';

describe('MockFS', () => {
  let fs: MockFS;

  beforeEach(() => {
    fs = new MockFS();
  });

  describe('File Operations', () => {
    describe('writeFile and readFile', () => {
      it('should write and read string files', async () => {
        await fs.writeFile('/test.txt', 'Hello World');
        const content = await fs.readFile('/test.txt', 'utf8');
        expect(content).toBe('Hello World');
      });

      it('should write and read binary files', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        await fs.writeFile('/test.bin', data);
        const content = await fs.readFile('/test.bin');
        expect(content).toEqual(data);
      });

      it('should read string as binary', async () => {
        await fs.writeFile('/test.txt', 'Hello');
        const content = await fs.readFile('/test.txt');
        // When no encoding is specified, should return Uint8Array
        expect(ArrayBuffer.isView(content)).toBe(true);
        expect(content).toHaveProperty('byteLength');
        const decoded = new TextDecoder().decode(content as Uint8Array);
        expect(decoded).toBe('Hello');
      });

      it('should read binary as string with utf8 encoding', async () => {
        const data = new TextEncoder().encode('Hello World');
        await fs.writeFile('/test.bin', data);
        const content = await fs.readFile('/test.bin', 'utf8');
        expect(content).toBe('Hello World');
      });

      it('should support encoding object option', async () => {
        await fs.writeFile('/test.txt', 'Hello');
        const content = await fs.readFile('/test.txt', { encoding: 'utf8' });
        expect(content).toBe('Hello');
      });

      it('should throw ENOENT when reading non-existent file', async () => {
        await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow('ENOENT');
        await expect(fs.readFile('/nonexistent.txt')).rejects.toMatchObject({
          code: 'ENOENT',
        });
      });

      it('should automatically create parent directory when writing file', async () => {
        await fs.writeFile('/dir/subdir/test.txt', 'Hello');
        const dirStat = await fs.stat('/dir/subdir');
        expect(dirStat.isDirectory()).toBe(true);
      });
    });

    describe('unlink', () => {
      it('should delete files', async () => {
        await fs.writeFile('/test.txt', 'Hello');
        await fs.unlink('/test.txt');
        await expect(fs.readFile('/test.txt')).rejects.toThrow('ENOENT');
      });

      it('should not throw when unlinking non-existent file', async () => {
        await expect(fs.unlink('/nonexistent.txt')).resolves.toBeUndefined();
      });
    });

    describe('rename', () => {
      it('should rename files', async () => {
        await fs.writeFile('/old.txt', 'Hello');
        await fs.rename('/old.txt', '/new.txt');
        const content = await fs.readFile('/new.txt', 'utf8');
        expect(content).toBe('Hello');
        await expect(fs.readFile('/old.txt')).rejects.toThrow('ENOENT');
      });

      it('should preserve file content when renaming', async () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        await fs.writeFile('/old.bin', data);
        await fs.rename('/old.bin', '/new.bin');
        const content = await fs.readFile('/new.bin');
        expect(content).toEqual(data);
      });
    });
  });

  describe('Directory Operations', () => {
    describe('mkdir', () => {
      it('should create directories', async () => {
        await fs.mkdir('/testdir');
        const stat = await fs.stat('/testdir');
        expect(stat.isDirectory()).toBe(true);
      });

      it('should create nested directories', async () => {
        await fs.mkdir('/parent');
        await fs.mkdir('/parent/child');
        const stat = await fs.stat('/parent/child');
        expect(stat.isDirectory()).toBe(true);
      });
    });

    describe('readdir', () => {
      it('should list files and directories', async () => {
        await fs.mkdir('/testdir');
        await fs.writeFile('/testdir/file1.txt', 'Hello');
        await fs.writeFile('/testdir/file2.txt', 'World');
        await fs.mkdir('/testdir/subdir');

        const entries = await fs.readdir('/testdir');
        expect(entries).toHaveLength(3);
        expect(entries).toContain('file1.txt');
        expect(entries).toContain('file2.txt');
        expect(entries).toContain('subdir');
      });

      it('should return empty array for empty directory', async () => {
        await fs.mkdir('/emptydir');
        const entries = await fs.readdir('/emptydir');
        expect(entries).toEqual([]);
      });

      it('should list root directory', async () => {
        await fs.writeFile('/root-file.txt', 'Hello');
        await fs.mkdir('/root-dir');
        const entries = await fs.readdir('/');
        expect(entries).toContain('root-file.txt');
        expect(entries).toContain('root-dir');
      });

      it('should support withFileTypes option', async () => {
        await fs.mkdir('/testdir');
        await fs.writeFile('/testdir/file.txt', 'Hello');
        await fs.mkdir('/testdir/subdir');

        const entries = await fs.readdir('/testdir', { withFileTypes: true });
        expect(entries).toHaveLength(2);

        const fileEntry = entries.find(e => e.name === 'file.txt');
        expect(fileEntry?.isFile()).toBe(true);
        expect(fileEntry?.isDirectory()).toBe(false);

        const dirEntry = entries.find(e => e.name === 'subdir');
        expect(dirEntry?.isDirectory()).toBe(true);
        expect(dirEntry?.isFile()).toBe(false);
      });

      it('should throw ENOENT when reading non-existent directory', async () => {
        await expect(fs.readdir('/nonexistent')).rejects.toThrow('ENOENT');
        await expect(fs.readdir('/nonexistent')).rejects.toMatchObject({
          code: 'ENOENT',
        });
      });

      it('should not list files from nested directories', async () => {
        await fs.mkdir('/parent');
        await fs.mkdir('/parent/child');
        await fs.writeFile('/parent/file1.txt', 'Hello');
        await fs.writeFile('/parent/child/file2.txt', 'World');

        const entries = await fs.readdir('/parent');
        expect(entries).toHaveLength(2);
        expect(entries).toContain('file1.txt');
        expect(entries).toContain('child');
        expect(entries).not.toContain('file2.txt');
      });
    });

    describe('rmdir', () => {
      it('should remove directories', async () => {
        await fs.mkdir('/testdir');
        await fs.rmdir('/testdir');
        await expect(fs.stat('/testdir')).rejects.toThrow('ENOENT');
      });

      it('should not throw when removing non-existent directory', async () => {
        await expect(fs.rmdir('/nonexistent')).resolves.toBeUndefined();
      });
    });

    describe('rename directories', () => {
      it('should rename directories', async () => {
        await fs.mkdir('/olddir');
        await fs.rename('/olddir', '/newdir');
        const stat = await fs.stat('/newdir');
        expect(stat.isDirectory()).toBe(true);
        await expect(fs.stat('/olddir')).rejects.toThrow('ENOENT');
      });
    });
  });

  describe('stat and lstat', () => {
    it('should stat files', async () => {
      await fs.writeFile('/test.txt', 'Hello World');
      const stat = await fs.stat('/test.txt');
      expect(stat.isFile()).toBe(true);
      expect(stat.isDirectory()).toBe(false);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(stat.size).toBe(11);
      expect(stat.mode).toBe(0o100644);
      expect(stat.mtimeMs).toBeDefined();
      expect(stat.mtime).toBeInstanceOf(Date);
      expect(stat.ctimeMs).toBeDefined();
      expect(stat.ctime).toBeInstanceOf(Date);
      expect(stat.ino).toBe(1);
      expect(stat.uid).toBe(1000);
      expect(stat.gid).toBe(1000);
    });

    it('should stat directories', async () => {
      await fs.mkdir('/testdir');
      const stat = await fs.stat('/testdir');
      expect(stat.isDirectory()).toBe(true);
      expect(stat.isFile()).toBe(false);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(stat.size).toBe(0);
      expect(stat.mode).toBe(0o40755);
    });

    it('should stat binary files with correct size', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await fs.writeFile('/test.bin', data);
      const stat = await fs.stat('/test.bin');
      expect(stat.size).toBe(5);
    });

    it('should throw ENOENT for non-existent paths', async () => {
      await expect(fs.stat('/nonexistent')).rejects.toThrow('ENOENT');
      await expect(fs.stat('/nonexistent')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });

    it('should have lstat behave identically to stat', async () => {
      await fs.writeFile('/test.txt', 'Hello');
      const statResult = await fs.stat('/test.txt');
      const lstatResult = await fs.lstat('/test.txt');
      // Compare the key properties (dates will differ slightly due to timing)
      expect(lstatResult.isFile()).toBe(statResult.isFile());
      expect(lstatResult.isDirectory()).toBe(statResult.isDirectory());
      expect(lstatResult.isSymbolicLink()).toBe(statResult.isSymbolicLink());
      expect(lstatResult.size).toBe(statResult.size);
      expect(lstatResult.mode).toBe(statResult.mode);
    });
  });

  describe('rm', () => {
    it('should remove files non-recursively', async () => {
      await fs.writeFile('/test.txt', 'Hello');
      await fs.rm('/test.txt');
      await expect(fs.readFile('/test.txt')).rejects.toThrow('ENOENT');
    });

    it('should remove files and directories recursively', async () => {
      await fs.mkdir('/parent');
      await fs.mkdir('/parent/child');
      await fs.writeFile('/parent/file1.txt', 'Hello');
      await fs.writeFile('/parent/child/file2.txt', 'World');

      await fs.rm('/parent', { recursive: true });

      await expect(fs.stat('/parent')).rejects.toThrow('ENOENT');
      await expect(fs.stat('/parent/child')).rejects.toThrow('ENOENT');
      await expect(fs.readFile('/parent/file1.txt')).rejects.toThrow('ENOENT');
      await expect(fs.readFile('/parent/child/file2.txt')).rejects.toThrow('ENOENT');
    });

    it('should remove only matching paths when recursive', async () => {
      await fs.mkdir('/keep');
      await fs.mkdir('/remove');
      await fs.writeFile('/keep/file.txt', 'Keep');
      await fs.writeFile('/remove/file.txt', 'Remove');

      await fs.rm('/remove', { recursive: true });

      const keepContent = await fs.readFile('/keep/file.txt', 'utf8');
      expect(keepContent).toBe('Keep');
      await expect(fs.readFile('/remove/file.txt')).rejects.toThrow('ENOENT');
    });
  });

  describe('Symbolic Links (No-op)', () => {
    it('should not throw when creating symlinks', async () => {
      await expect(fs.symlink('/target', '/link')).resolves.toBeUndefined();
    });

    it('should throw EINVAL when reading symlinks', async () => {
      await expect(fs.readlink('/link')).rejects.toThrow('EINVAL');
      await expect(fs.readlink('/link')).rejects.toMatchObject({
        code: 'EINVAL',
      });
    });
  });

  describe('chmod (No-op)', () => {
    it('should not throw when changing permissions', async () => {
      await fs.writeFile('/test.txt', 'Hello');
      await expect(fs.chmod('/test.txt', 0o755)).resolves.toBeUndefined();
    });
  });

  describe('promises property', () => {
    it('should expose promises property for isomorphic-git compatibility', () => {
      expect(fs.promises).toBe(fs);
    });
  });

  describe('Edge Cases', () => {
    it('should handle paths with multiple slashes', async () => {
      await fs.writeFile('/dir//file.txt', 'Hello');
      // The mock doesn't normalize paths, so this creates a literal path
      const content = await fs.readFile('/dir//file.txt', 'utf8');
      expect(content).toBe('Hello');
    });

    it('should handle empty file content', async () => {
      await fs.writeFile('/empty.txt', '');
      const content = await fs.readFile('/empty.txt', 'utf8');
      expect(content).toBe('');
    });

    it('should handle empty binary content', async () => {
      await fs.writeFile('/empty.bin', new Uint8Array(0));
      const content = await fs.readFile('/empty.bin');
      expect(content).toEqual(new Uint8Array(0));
    });

    it('should handle deeply nested directories', async () => {
      await fs.mkdir('/a');
      await fs.mkdir('/a/b');
      await fs.mkdir('/a/b/c');
      await fs.mkdir('/a/b/c/d');
      await fs.writeFile('/a/b/c/d/file.txt', 'Deep');

      const content = await fs.readFile('/a/b/c/d/file.txt', 'utf8');
      expect(content).toBe('Deep');

      const stat = await fs.stat('/a/b/c/d');
      expect(stat.isDirectory()).toBe(true);
    });

    it('should handle root directory stat', async () => {
      const stat = await fs.stat('/');
      expect(stat.isDirectory()).toBe(true);
      expect(stat.isFile()).toBe(false);
    });
  });
});
