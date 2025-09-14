import { describe, it, expect } from 'vitest';
import { 
  isAbsolutePath, 
  isWriteAllowed, 
  validateWritePath, 
  createWriteAccessDeniedError 
} from './security';

describe('security', () => {
  describe('isAbsolutePath', () => {
    it('should detect Unix absolute paths', () => {
      expect(isAbsolutePath('/tmp/file.txt')).toBe(true);
      expect(isAbsolutePath('/home/user/file.txt')).toBe(true);
      expect(isAbsolutePath('/absolute/path')).toBe(true);
    });

    it('should detect Windows absolute paths', () => {
      expect(isAbsolutePath('C:\\temp\\file.txt')).toBe(true);
      expect(isAbsolutePath('D:/folder/file.txt')).toBe(true);
      expect(isAbsolutePath('\\\\server\\share')).toBe(true);
    });

    it('should detect relative paths', () => {
      expect(isAbsolutePath('src/index.ts')).toBe(false);
      expect(isAbsolutePath('./src/index.ts')).toBe(false);
      expect(isAbsolutePath('../parent/file.txt')).toBe(false);
      expect(isAbsolutePath('file.txt')).toBe(false);
    });
  });

  describe('isWriteAllowed', () => {
    it('should allow writes to /tmp/', () => {
      expect(isWriteAllowed('/tmp')).toBe(true);
      expect(isWriteAllowed('/tmp/')).toBe(true);
      expect(isWriteAllowed('/tmp/file.txt')).toBe(true);
      expect(isWriteAllowed('/tmp/subdir/file.txt')).toBe(true);
    });

    it('should deny writes to other absolute paths', () => {
      expect(isWriteAllowed('/home/user/file.txt')).toBe(false);
      expect(isWriteAllowed('/var/log/file.txt')).toBe(false);
      expect(isWriteAllowed('/absolute/path')).toBe(false);
      expect(isWriteAllowed('/etc/passwd')).toBe(false);
    });
  });

  describe('validateWritePath', () => {
    it('should allow relative paths', () => {
      expect(() => validateWritePath('src/index.ts', 'test')).not.toThrow();
      expect(() => validateWritePath('./file.txt', 'test')).not.toThrow();
      expect(() => validateWritePath('../parent/file.txt', 'test')).not.toThrow();
    });

    it('should allow /tmp/ absolute paths', () => {
      expect(() => validateWritePath('/tmp/file.txt', 'test')).not.toThrow();
      expect(() => validateWritePath('/tmp/subdir/file.txt', 'test')).not.toThrow();
    });

    it('should reject other absolute paths', () => {
      expect(() => validateWritePath('/absolute/path', 'test')).toThrow('write access denied');
      expect(() => validateWritePath('/home/user/file.txt', 'test')).toThrow('write access denied');
    });

    it('should include operation name in error message', () => {
      expect(() => validateWritePath('/absolute/path', 'mkdir')).toThrow('mkdir: write access denied');
    });

    it('should include current working directory in error message', () => {
      expect(() => validateWritePath('/absolute/path', 'test', '/project')).toThrow('/project');
    });
  });

  describe('createWriteAccessDeniedError', () => {
    it('should create formatted error message without tool name', () => {
      const error = createWriteAccessDeniedError('/absolute/path');
      expect(error).toContain('Write access denied to /absolute/path');
      expect(error).toContain('Write operations are only allowed in:');
      expect(error).toContain('- Current project directory (relative paths)');
      expect(error).toContain('- /tmp/ directory and its subdirectories');
      expect(error).toContain('💡 Examples of allowed paths:');
    });

    it('should create formatted error message with tool name', () => {
      const error = createWriteAccessDeniedError('/absolute/path', 'TextEditor');
      expect(error).toContain('❌ Write access denied to "/absolute/path"');
    });

    it('should include current working directory when provided', () => {
      const error = createWriteAccessDeniedError('/absolute/path', undefined, '/project');
      expect(error).toContain('Current working directory: /project');
    });
  });
});