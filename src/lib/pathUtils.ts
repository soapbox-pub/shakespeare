/**
 * Cross-platform path utilities for handling both Unix and Windows path separators.
 * These utilities ensure consistent behavior across different operating systems.
 */

/**
 * Get the parent directory of a path, handling both forward and back slashes.
 * This is particularly important for Windows paths in Electron.
 *
 * @param path - The file or directory path
 * @returns The parent directory path, or empty string if at root
 */
export function getParentDirectory(path: string): string {
  // Find the last occurrence of either separator
  const lastForwardSlash = path.lastIndexOf('/');
  const lastBackSlash = path.lastIndexOf('\\');
  const lastSeparator = Math.max(lastForwardSlash, lastBackSlash);

  if (lastSeparator === -1) {
    return '';
  }

  return path.substring(0, lastSeparator);
}

/**
 * Normalize a path to use forward slashes consistently.
 * This is useful for the VFS which uses Unix-style paths internally.
 *
 * @param path - The path to normalize
 * @returns The path with all backslashes converted to forward slashes
 */
export function normalizeToForwardSlashes(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Normalize a path to use the native separator for the current platform.
 * On Windows, uses backslashes; on Unix-like systems, uses forward slashes.
 *
 * @param path - The path to normalize
 * @returns The path with separators appropriate for the current platform
 */
export function normalizeToNativeSeparator(path: string): string {
  const isWindows = typeof navigator !== 'undefined'
    ? navigator.platform?.toLowerCase().includes('win')
    : false;

  if (isWindows) {
    return path.replace(/\//g, '\\');
  }
  return path.replace(/\\/g, '/');
}

/**
 * Join path segments with forward slashes, regardless of platform.
 * This is useful for VFS paths which always use forward slashes.
 *
 * @param segments - Path segments to join
 * @returns The joined path with forward slashes
 */
export function joinWithForwardSlashes(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .map(s => s.replace(/^[/\\]+|[/\\]+$/g, '')) // Trim leading/trailing slashes
    .join('/');
}

/**
 * Check if a path is absolute on any platform.
 * Recognizes:
 * - Unix absolute paths starting with /
 * - Windows absolute paths starting with \ or drive letter (C:\)
 *
 * @param path - The path to check
 * @returns True if the path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Get the file name from a path, handling both separators.
 *
 * @param path - The file path
 * @returns The file name
 */
export function getBasename(path: string): string {
  const lastForwardSlash = path.lastIndexOf('/');
  const lastBackSlash = path.lastIndexOf('\\');
  const lastSeparator = Math.max(lastForwardSlash, lastBackSlash);

  if (lastSeparator === -1) {
    return path;
  }

  return path.substring(lastSeparator + 1);
}

/**
 * Expand tilde (~) in paths to the home directory.
 * Works with both Unix (~/) and Windows (~\) style paths.
 *
 * @param path - The path that may contain tilde
 * @param homedir - The user's home directory
 * @returns The expanded path
 */
export function expandTildePath(path: string, homedir: string): string {
  if (path === '~') {
    return homedir;
  }
  if (path.startsWith('~/')) {
    return homedir + path.slice(1);
  }
  if (path.startsWith('~\\')) {
    return homedir + path.slice(1);
  }
  return path;
}

