/**
 * Security utilities for path validation and access control
 */

import { normalize } from "path-browserify";

/**
 * Check if the given path is an absolute path
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Check if write operations are allowed for the given path
 *
 * Write operations are only allowed in:
 * - /tmp/ directory and its subdirectories
 * - /projects/ directory and its subdirectories (project directories)
 * - Relative paths (always allowed, regardless of where they resolve to)
 * - Absolute paths that resolve to within the current working directory
 */
export function isWriteAllowed(path: string, cwd?: string): boolean {
  // Always allow relative paths (this follows traditional Unix security model)
  if (!isAbsolutePath(path)) {
    return true;
  }

  // For absolute paths, apply restrictions
  const absolutePath = normalize(path);

  // Allow writes to /tmp/ and its subdirectories
  if (absolutePath.startsWith('/tmp/') || absolutePath === '/tmp') {
    return true;
  }

  // Allow writes to /projects/ and its subdirectories (project directories)
  if (absolutePath.startsWith('/projects/') || absolutePath === '/projects') {
    return true;
  }

  // If we have a current working directory, allow writes within that directory tree
  if (cwd) {
    const normalizedCwd = normalize(cwd);
    if (absolutePath.startsWith(normalizedCwd + '/') || absolutePath === normalizedCwd) {
      return true;
    }
  }

  // Deny all other absolute paths
  return false;
}

/**
 * Validate a path for write operations and throw descriptive errors
 *
 * @param path - The path to validate (can be absolute or relative)
 * @param operationName - Name of the operation for error messages (e.g., 'touch', 'mkdir')
 * @param cwd - Current working directory for context in error messages
 * @throws Error if the path is not allowed for write operations
 */
export function validateWritePath(path: string, operationName: string, cwd?: string): void {
  if (!isWriteAllowed(path, cwd)) {
    const cwdInfo = cwd ? `\n\nCurrent working directory: ${cwd}` : '';
    throw new Error(
      `${operationName}: write access denied to ${path}. ` +
      `Write operations are only allowed in project directories and /tmp/${cwdInfo}`
    );
  }
}

/**
 * Create a standardized error message for write access denial
 *
 * @param path - The path that was denied
 * @param toolName - Name of the tool/command for context
 * @param cwd - Current working directory for context
 * @returns Formatted error message
 */
export function createWriteAccessDeniedError(path: string, toolName?: string, cwd?: string): string {
  const prefix = toolName ? `❌ Write access denied to "${path}".` : `Write access denied to ${path}.`;
  const cwdInfo = cwd ? `\n\nCurrent working directory: ${cwd}` : '';

  return (
    `${prefix}\n\n` +
    `Write operations are only allowed in:\n` +
    `- Current working directory and subdirectories\n` +
    `- Project directories (/projects/ and subdirectories)\n` +
    `- Temporary directory (/tmp/ and subdirectories)\n` +
    `- Relative paths (resolved relative to current directory)\n\n` +
    `💡 Examples of allowed paths:\n` +
    `- "src/index.ts" (relative to current directory)\n` +
    `- "/projects/my-project/src/file.js" (absolute project path)\n` +
    `- "/tmp/temp-file.txt" (temporary files)\n` +
    `- "/tmp/workspace/file.js" (temporary workspace)${cwdInfo}`
  );
}