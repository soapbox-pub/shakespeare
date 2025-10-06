/**
 * Converts yarn.lock format to package-lock.json format for use with esmPlugin.
 * This is a simplified converter that extracts enough information for dependency resolution.
 */

interface YarnLockEntry {
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface PackageLockPackage {
  name?: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface PackageLock {
  packages: {
    [key: string]: PackageLockPackage;
  };
}

/**
 * Parse a yarn.lock file and convert it to package-lock.json format
 */
export function convertYarnLockToPackageLock(yarnLockContent: string): PackageLock {
  const packages: Record<string, PackageLockPackage> = {};

  // Parse yarn.lock entries
  const entries = parseYarnLock(yarnLockContent);

  // Convert each entry to package-lock format
  for (const [key, entry] of Object.entries(entries)) {
    // Extract package name from the yarn.lock key
    // Keys can be like: "package@^1.0.0" or "@scope/package@^1.0.0" or "package@npm:other@^1.0.0"
    const packageName = extractPackageName(key);

    if (!packageName) continue;

    // Create a node_modules path for this package
    const lockPath = `node_modules/${packageName}`;

    packages[lockPath] = {
      name: packageName,
      version: entry.version,
      dependencies: entry.dependencies,
      peerDependencies: entry.peerDependencies,
    };
  }

  return { packages };
}

/**
 * Parse yarn.lock content into a map of entries
 */
function parseYarnLock(content: string): Record<string, YarnLockEntry> {
  const entries: Record<string, YarnLockEntry> = {};
  const lines = content.split('\n');

  let currentKey: string | null = null;
  let currentEntry: Partial<YarnLockEntry> = {};
  let inDependencies = false;
  let inPeerDependencies = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    // Check if this is a package header (starts without indentation and ends with :)
    if (line.match(/^[^"\s].*:$/) || line.match(/^".*":$/)) {
      // Save previous entry if exists
      if (currentKey && currentEntry.version) {
        entries[currentKey] = currentEntry as YarnLockEntry;
      }

      // Start new entry
      currentKey = line.replace(/:$/, '').replace(/^"|"$/g, '');
      currentEntry = {};
      inDependencies = false;
      inPeerDependencies = false;
      continue;
    }

    // Parse indented properties
    const propertyMatch = line.match(/^\s{2}(\S+):\s*$/);
    const valueMatch = line.match(/^\s{2}(\S+)\s+"?([^"]+)"?\s*$/);
    const depMatch = line.match(/^\s{4}(\S+)\s+"?([^"]+)"?\s*$/);

    if (propertyMatch && currentKey) {
      const [, key] = propertyMatch;

      if (key === 'dependencies') {
        inDependencies = true;
        inPeerDependencies = false;
        currentEntry.dependencies = {};
      } else if (key === 'peerDependencies') {
        inPeerDependencies = true;
        inDependencies = false;
        currentEntry.peerDependencies = {};
      } else {
        inDependencies = false;
        inPeerDependencies = false;
      }
    } else if (valueMatch && currentKey && !inDependencies && !inPeerDependencies) {
      const [, key, value] = valueMatch;
      const cleanValue = value.replace(/^"|"$/g, '');

      if (key === 'version') {
        currentEntry.version = cleanValue;
      }
    } else if (depMatch && currentKey) {
      const [, key, value] = depMatch;
      const cleanValue = value.replace(/^"|"$/g, '');

      if (inDependencies && currentEntry.dependencies) {
        currentEntry.dependencies[key] = cleanValue;
      } else if (inPeerDependencies && currentEntry.peerDependencies) {
        currentEntry.peerDependencies[key] = cleanValue;
      }
    }
  }

  // Save last entry
  if (currentKey && currentEntry.version) {
    entries[currentKey] = currentEntry as YarnLockEntry;
  }

  return entries;
}

/**
 * Extract the package name from a yarn.lock key
 * Examples:
 *   "react@^18.0.0" -> "react"
 *   "@babel/core@^7.0.0" -> "@babel/core"
 *   "package@npm:other@^1.0.0" -> "package"
 */
function extractPackageName(key: string): string | null {
  // Remove quotes if present
  const cleaned = key.replace(/^"|"$/g, '');

  // Handle npm alias syntax: "package@npm:other@^1.0.0"
  if (cleaned.includes('@npm:')) {
    const beforeNpm = cleaned.split('@npm:')[0];
    return beforeNpm.replace(/@[^@]*$/, '') || null;
  }

  // Handle scoped packages: "@scope/package@^1.0.0"
  if (cleaned.startsWith('@')) {
    const parts = cleaned.split('@');
    // parts will be: ['', 'scope/package', '^1.0.0'] or ['', 'scope/package', 'npm:...']
    if (parts.length >= 2) {
      return `@${parts[1]}`;
    }
  }

  // Handle regular packages: "package@^1.0.0"
  const atIndex = cleaned.indexOf('@');
  if (atIndex > 0) {
    return cleaned.substring(0, atIndex);
  }

  // If no @ found, return the whole string (shouldn't happen in valid yarn.lock)
  return cleaned || null;
}
