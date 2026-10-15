import { join } from "path-browserify";
import { isAbsolutePath } from "../security";

/**
 * Resolve a path argument to an absolute path.
 * - Absolute paths are returned as-is.
 * - Relative paths are resolved against `cwd`.
 */
export function resolvePath(path: string, cwd: string): string {
  if (isAbsolutePath(path)) return path;
  return join(cwd, path);
}
