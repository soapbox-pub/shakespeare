import ignore from 'ignore';
import type { JSRuntimeFS } from './JSRuntime';

/**
 * Creates a gitignore filter function that can check if files should be ignored
 */
export async function createGitignoreFilter(
  fs: JSRuntimeFS,
  projectPath: string
): Promise<{
  isIgnored: (path: string) => boolean;
  shouldShow: (path: string) => boolean;
}> {
  const ig = ignore();

  // Always ignore .git directory
  ig.add('.git');

  try {
    // Try to read .gitignore file from the project root
    const gitignorePath = `${projectPath}/.gitignore`;
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    ig.add(gitignoreContent);
  } catch {
    // If there's an error reading .gitignore, continue without it
    // We'll still show all files, just won't have gitignore patterns
  }

  return {
    isIgnored: (path: string) => ig.ignores(path),
    shouldShow: (path: string) => !ig.ignores(path) || path === '.gitignore', // Always show .gitignore itself
  };
}

/**
 * Normalizes a file path for gitignore checking by removing leading slashes
 */
export function normalizePathForGitignore(path: string): string {
  // Remove leading slash if present
  return path.startsWith('/') ? path.slice(1) : path;
}