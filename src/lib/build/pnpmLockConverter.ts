/**
 * Converts pnpm-lock.yaml format to package-lock.json format for use with esmPlugin.
 * This is a simplified converter that extracts enough information for dependency resolution.
 */

interface PnpmLockPackage {
  version?: string;
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
 * Parse a pnpm-lock.yaml file and convert it to package-lock.json format
 */
export function convertPnpmLockToPackageLock(pnpmLockContent: string): PackageLock {
  const packages: Record<string, PackageLockPackage> = {};

  // Parse pnpm-lock.yaml entries
  const entries = parsePnpmLock(pnpmLockContent);

  // Track which package@version combinations we've seen to handle duplicates
  const seenVersions = new Map<string, number>();

  for (const [key, entry] of Object.entries(entries)) {
    if (!entry.version) continue;

    const packageName = extractPackageName(key);
    if (!packageName) continue;

    const versionKey = `${packageName}@${entry.version}`;
    const count = seenVersions.get(versionKey) || 0;
    seenVersions.set(versionKey, count + 1);

    // Determine the lock path
    let lockPath: string;

    if (count === 0) {
      // First occurrence - use simple node_modules path
      lockPath = `node_modules/${packageName}`;
    } else {
      // Subsequent occurrences - create unique nested paths
      // This handles cases where the same package@version is installed
      // multiple times with different peer dependencies
      lockPath = `node_modules/.pnpm/${packageName}_${count}`;
    }

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
 * Parse pnpm-lock.yaml content into a map of entries
 * This is a simple YAML parser focused on the packages section
 */
function parsePnpmLock(content: string): Record<string, PnpmLockPackage> {
  const entries: Record<string, PnpmLockPackage> = {};
  const lines = content.split('\n');

  let inPackagesSection = false;
  let currentKey: string | null = null;
  let currentEntry: Partial<PnpmLockPackage> = {};
  let inDependencies = false;
  let inPeerDependencies = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') {
      continue;
    }

    // Detect the packages section
    if (line.match(/^packages:/)) {
      inPackagesSection = true;
      continue;
    }

    // Exit packages section when we hit another top-level key
    if (inPackagesSection && line.match(/^[a-zA-Z]/)) {
      inPackagesSection = false;
      // Save last entry before exiting
      if (currentKey && currentEntry.version) {
        entries[currentKey] = currentEntry as PnpmLockPackage;
      }
      break;
    }

    if (!inPackagesSection) continue;

    // Get indentation level
    const indent = line.search(/\S/);
    if (indent === -1) continue;

    // Package entry (2-space indent from packages:)
    // Example: "  /@babel/core@7.23.0:"
    const packageMatch = line.match(/^ {2}(\/[^:]+):\s*$/);
    if (packageMatch) {
      // Save previous entry
      if (currentKey && currentEntry.version) {
        entries[currentKey] = currentEntry as PnpmLockPackage;
      }

      // Start new entry
      currentKey = packageMatch[1];
      currentEntry = {};
      inDependencies = false;
      inPeerDependencies = false;
      continue;
    }

    // Skip if we don't have a current package
    if (!currentKey) continue;

    // Property lines (4-space indent from package key)
    const propertyMatch = line.match(/^ {4}([a-zA-Z]+):\s*$/);
    const valueMatch = line.match(/^ {4}([a-zA-Z]+):\s*(.+)\s*$/);
    const depMatch = line.match(/^ {6}([^:]+):\s*(.+)\s*$/);

    if (propertyMatch) {
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
    } else if (valueMatch && !inDependencies && !inPeerDependencies) {
      const [, key, value] = valueMatch;

      if (key === 'version') {
        currentEntry.version = value.trim();
      }
    } else if (depMatch) {
      const [, key, value] = depMatch;
      const cleanKey = key.trim();
      // Remove quotes from value if present
      const cleanValue = value.trim().replace(/^['"]|['"]$/g, '');

      if (inDependencies && currentEntry.dependencies) {
        currentEntry.dependencies[cleanKey] = cleanValue;
      } else if (inPeerDependencies && currentEntry.peerDependencies) {
        currentEntry.peerDependencies[cleanKey] = cleanValue;
      }
    }
  }

  // Save last entry
  if (currentKey && currentEntry.version) {
    entries[currentKey] = currentEntry as PnpmLockPackage;
  }

  return entries;
}

/**
 * Extract the package name from a pnpm-lock.yaml key
 * Examples:
 *   "/@babel/core@7.23.0" -> "@babel/core"
 *   "/react@18.2.0" -> "react"
 *   "/react-dom@18.2.0(react@18.2.0)" -> "react-dom"
 */
function extractPackageName(key: string): string | null {
  // Remove leading slash
  let cleaned = key.startsWith('/') ? key.slice(1) : key;

  // Remove peer dependency specifications in parentheses
  // Example: "react-dom@18.2.0(react@18.2.0)" -> "react-dom@18.2.0"
  cleaned = cleaned.replace(/\([^)]*\)$/, '');

  // Handle scoped packages: "@scope/package@version"
  if (cleaned.startsWith('@')) {
    const parts = cleaned.split('@');
    // parts will be: ['', 'scope/package', 'version']
    if (parts.length >= 2) {
      return `@${parts[1]}`;
    }
  }

  // Handle regular packages: "package@version"
  const atIndex = cleaned.indexOf('@');
  if (atIndex > 0) {
    return cleaned.substring(0, atIndex);
  }

  // If no @ found, return the whole string
  return cleaned || null;
}
