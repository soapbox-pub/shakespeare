import { describe, it, expect } from 'vitest';
import { 
  validateFile, 
  validateFiles, 
  formatFileSize, 
  isImageFile, 
  isTextFile,
  DEFAULT_MAX_SIZE 
} from './fileValidation';

describe('fileValidation', () => {
  describe('validateFile', () => {
    it('should return null for valid file', () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = validateFile(file);
      expect(result).toBeNull();
    });

    it('should return error for file that is too large', () => {
      const largeFile = new File(['x'.repeat(DEFAULT_MAX_SIZE + 1)], 'large.txt', { type: 'text/plain' });
      const result = validateFile(largeFile, { maxSize: DEFAULT_MAX_SIZE });
      
      expect(result).not.toBeNull();
      expect(result?.error).toContain('is too large');
      expect(result?.file).toBe(largeFile);
    });

    it('should accept file within size limit', () => {
      const file = new File(['test content'], 'small.txt', { type: 'text/plain' });
      const result = validateFile(file, { maxSize: 1024 }); // 1KB limit
      
      expect(result).toBeNull();
    });

    it('should return error for unsupported file type', () => {
      const file = new File(['test content'], 'test.exe', { type: 'application/x-executable' });
      const result = validateFile(file, { accept: 'image/*,.txt' });
      
      expect(result).not.toBeNull();
      expect(result?.error).toContain('not a supported type');
    });

    it('should accept image files when image/* is specified', () => {
      const imageFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFile(imageFile, { accept: 'image/*' });
      
      expect(result).toBeNull();
    });

    it('should accept files with specific extension', () => {
      const textFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const result = validateFile(textFile, { accept: '.txt' });
      
      expect(result).toBeNull();
    });

    it('should accept all files when accept is */*', () => {
      const file = new File(['test content'], 'test.any', { type: 'application/unknown' });
      const result = validateFile(file, { accept: '*/*' });
      
      expect(result).toBeNull();
    });
  });

  describe('validateFiles', () => {
    it('should return all valid files and no errors for valid input', () => {
      const files = [
        new File(['content1'], 'file1.txt', { type: 'text/plain' }),
        new File(['content2'], 'file2.txt', { type: 'text/plain' }),
      ];
      
      const result = validateFiles(files);
      
      expect(result.validFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.validFiles).toEqual(files);
    });

    it('should filter out invalid files and return errors', () => {
      const validFile = new File(['valid content'], 'valid.txt', { type: 'text/plain' });
      const largeFile = new File(['x'.repeat(DEFAULT_MAX_SIZE + 1)], 'large.txt', { type: 'text/plain' });
      
      const result = validateFiles([validFile, largeFile], { maxSize: DEFAULT_MAX_SIZE });
      
      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.validFiles[0]).toBe(validFile);
      expect(result.errors[0].file).toBe(largeFile);
    });

    it('should respect maxFiles limit', () => {
      const files = Array.from({ length: 5 }, (_, i) => 
        new File([`content${i}`], `file${i}.txt`, { type: 'text/plain' })
      );
      
      const result = validateFiles(files, { maxFiles: 3 });
      
      expect(result.validFiles).toHaveLength(3);
      expect(result.errors).toHaveLength(2); // 2 files exceeded the limit
      expect(result.errors[0].error).toContain('Too many files');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should format decimal values correctly', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });
  });

  describe('isImageFile', () => {
    it('should return true for image files', () => {
      expect(isImageFile(new File([''], 'test.jpg', { type: 'image/jpeg' }))).toBe(true);
      expect(isImageFile(new File([''], 'test.png', { type: 'image/png' }))).toBe(true);
      expect(isImageFile(new File([''], 'test.gif', { type: 'image/gif' }))).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile(new File([''], 'test.txt', { type: 'text/plain' }))).toBe(false);
      expect(isImageFile(new File([''], 'test.pdf', { type: 'application/pdf' }))).toBe(false);
    });
  });

  describe('isTextFile', () => {
    it('should return true for text files by MIME type', () => {
      expect(isTextFile(new File([''], 'test.txt', { type: 'text/plain' }))).toBe(true);
      expect(isTextFile(new File([''], 'test.js', { type: 'text/javascript' }))).toBe(true);
      expect(isTextFile(new File([''], 'test.json', { type: 'application/json' }))).toBe(true);
    });

    it('should return true for text files by extension', () => {
      expect(isTextFile(new File([''], 'test.md', { type: 'application/octet-stream' }))).toBe(true);
      expect(isTextFile(new File([''], 'test.tsx', { type: 'application/octet-stream' }))).toBe(true);
    });

    it('should return false for non-text files', () => {
      expect(isTextFile(new File([''], 'test.jpg', { type: 'image/jpeg' }))).toBe(false);
      expect(isTextFile(new File([''], 'test.pdf', { type: 'application/pdf' }))).toBe(false);
    });
  });
});