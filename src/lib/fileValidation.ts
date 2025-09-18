/**
 * File validation utilities for the Shakespeare application
 */

export interface FileValidationError {
  file: File;
  error: string;
}

export interface FileValidationOptions {
  maxSize?: number; // in bytes
  accept?: string; // MIME types or extensions
  maxFiles?: number;
}

/**
 * Default file size limit: 10MB
 */
export const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/**
 * Default accepted file types
 */
export const DEFAULT_ACCEPT = '*/*';

/**
 * Validate a single file against the given constraints
 */
export function validateFile(file: File, options: FileValidationOptions = {}): FileValidationError | null {
  const { maxSize = DEFAULT_MAX_SIZE, accept = DEFAULT_ACCEPT } = options;

  // Check file size
  if (file.size > maxSize) {
    return {
      file,
      error: `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}.`
    };
  }

  // Check file type if accept is specified and not wildcard
  if (accept !== '*/*') {
    const acceptedTypes = accept.split(',').map(type => type.trim());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    const isAccepted = acceptedTypes.some(acceptedType => {
      if (acceptedType.startsWith('.')) {
        // Extension check (e.g., ".jpg", ".png")
        return fileExtension === acceptedType.toLowerCase();
      } else if (acceptedType.includes('/')) {
        // MIME type check (e.g., "image/*", "application/pdf")
        if (acceptedType.endsWith('/*')) {
          // Wildcard MIME type (e.g., "image/*")
          const mainType = acceptedType.split('/')[0];
          return file.type.startsWith(mainType + '/');
        } else {
          // Exact MIME type match
          return file.type === acceptedType;
        }
      }
      return false;
    });

    if (!isAccepted) {
      return {
        file,
        error: `File "${file.name}" is not a supported type.`
      };
    }
  }

  return null;
}

/**
 * Validate multiple files against the given constraints
 */
export function validateFiles(files: File[], options: FileValidationOptions = {}): {
  validFiles: File[];
  errors: FileValidationError[];
} {
  const { maxFiles } = options;
  const validFiles: File[] = [];
  const errors: FileValidationError[] = [];

  // Check maximum number of files
  if (maxFiles && files.length > maxFiles) {
    const excessFiles = files.slice(maxFiles);
    excessFiles.forEach(file => {
      errors.push({
        file,
        error: `Too many files. Maximum ${maxFiles} files allowed.`
      });
    });
    files = files.slice(0, maxFiles);
  }

  // Validate each file
  files.forEach(file => {
    const error = validateFile(file, options);
    if (error) {
      errors.push(error);
    } else {
      validFiles.push(file);
    }
  });

  return { validFiles, errors };
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a file is a text file
 */
export function isTextFile(file: File): boolean {
  const textMimeTypes = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript',
    'application/x-javascript',
    'text/markdown',
    'text/x-markdown'
  ];
  
  return textMimeTypes.includes(file.type) || 
         file.name.match(/\.(txt|md|markdown|html|css|js|ts|jsx|tsx|json|xml)$/i) !== null;
}