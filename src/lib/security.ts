/**
 * Security utilities for path validation and access control
 */

/**
 * Check if the given path is an absolute path
 */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Check if write operations are allowed for the given absolute path
 * 
 * Write operations are only allowed in:
 * - /tmp/ directory and its subdirectories
 * - Current project directory (handled via relative paths)
 */
export function isWriteAllowed(absolutePath: string): boolean {
  // Allow writes to /tmp/ and its subdirectories
  if (absolutePath.startsWith('/tmp/') || absolutePath === '/tmp') {
    return true;
  }
  
  // For other absolute paths, deny write access
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
  if (isAbsolutePath(path) && !isWriteAllowed(path)) {
    const cwdInfo = cwd ? `\n\nCurrent working directory: ${cwd}` : '';
    throw new Error(
      `${operationName}: write access denied to ${path}. ` +
      `Write operations are only allowed in project directory and /tmp/${cwdInfo}`
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
    `- Current project directory (relative paths)\n` +
    `- /tmp/ directory and its subdirectories\n\n` +
    `💡 Examples of allowed paths:\n` +
    `- "src/index.ts" (relative to current directory)\n` +
    `- "/tmp/temp-file.txt" (temporary files)\n` +
    `- "/tmp/workspace/file.js" (temporary workspace)${cwdInfo}`
  );
}