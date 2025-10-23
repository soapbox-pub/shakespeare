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
 * - Configured tmp directory and its subdirectories
 * - Configured projects directory and its subdirectories (project directories)
 * - Relative paths (always allowed, regardless of where they resolve to)
 * - Absolute paths that resolve to within the current working directory
 *
 * @param path - The path to check
 * @param cwd - Current working directory (optional)
 * @param options - Optional configuration for allowed paths
 */
export function isWriteAllowed(
  path: string,
  cwd?: string,
  options?: {
    tmpPath?: string;
    projectsPath?: string;
  }
): boolean {
  // Always allow relative paths (this follows traditional Unix security model)
  if (!isAbsolutePath(path)) {
    return true;
  }

  // For absolute paths, apply restrictions
  const absolutePath = normalize(path);

  // Get configured paths with defaults
  const tmpPath = options?.tmpPath || '/tmp';
  const projectsPath = options?.projectsPath || '/projects';

  // Allow writes to tmp directory and its subdirectories
  if (absolutePath.startsWith(tmpPath + '/') || absolutePath === tmpPath) {
    return true;
  }

  // Allow writes to projects directory and its subdirectories (project directories)
  if (absolutePath.startsWith(projectsPath + '/') || absolutePath === projectsPath) {
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
 * @param options - Optional configuration for allowed paths
 * @throws Error if the path is not allowed for write operations
 */
export function validateWritePath(
  path: string,
  operationName: string,
  cwd?: string,
  options?: {
    tmpPath?: string;
    projectsPath?: string;
  }
): void {
  if (!isWriteAllowed(path, cwd, options)) {
    const tmpPath = options?.tmpPath || '/tmp';
    const cwdInfo = cwd ? `\n\nCurrent working directory: ${cwd}` : '';
    throw new Error(
      `${operationName}: write access denied to ${path}. ` +
      `Write operations are only allowed in project directories and ${tmpPath}${cwdInfo}`
    );
  }
}

/**
 * Create a standardized error message for write access denial
 *
 * @param path - The path that was denied
 * @param toolName - Name of the tool/command for context
 * @param cwd - Current working directory for context
 * @param options - Optional configuration for allowed paths
 * @returns Formatted error message
 */
export function createWriteAccessDeniedError(
  path: string,
  toolName?: string,
  cwd?: string,
  options?: {
    tmpPath?: string;
    projectsPath?: string;
  }
): string {
  const prefix = toolName ? `❌ Write access denied to "${path}".` : `Write access denied to ${path}.`;
  const cwdInfo = cwd ? `\n\nCurrent working directory: ${cwd}` : '';
  const tmpPath = options?.tmpPath || '/tmp';
  const projectsPath = options?.projectsPath || '/projects';

  return (
    `${prefix}\n\n` +
    `Write operations are only allowed in:\n` +
    `- Current working directory and subdirectories\n` +
    `- Project directories (${projectsPath}/ and subdirectories)\n` +
    `- Temporary directory (${tmpPath}/ and subdirectories)\n` +
    `- Relative paths (resolved relative to current directory)\n\n` +
    `💡 Examples of allowed paths:\n` +
    `- "src/index.ts" (relative to current directory)\n` +
    `- "${projectsPath}/my-project/src/file.js" (absolute project path)\n` +
    `- "${tmpPath}/temp-file.txt" (temporary files)\n` +
    `- "${tmpPath}/workspace/file.js" (temporary workspace)${cwdInfo}`
  );
}