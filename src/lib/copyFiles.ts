import type { JSRuntimeFS, DirectoryEntry } from './JSRuntime';
import type LightningFS from '@isomorphic-git/lightning-fs';

/**
 * Copy files and directories between two filesystem instances
 * @param sourceFS Source filesystem (e.g., WebContainer fs)
 * @param targetFS Target filesystem (e.g., LightningFS)
 * @param sourcePath Source directory path
 * @param targetPath Target directory path
 */
export async function copyFiles(
  sourceFS: JSRuntimeFS,
  targetFS: LightningFS.PromisifiedFS,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    console.log(`Copying: ${sourcePath} -> ${targetPath}`);

    // Get source directory contents
    const items = await sourceFS.readdir(sourcePath, { withFileTypes: true }) as DirectoryEntry[];
    console.log(`Found ${items.length} items in ${sourcePath}`);

    // Ensure target directory exists
    try {
      await targetFS.mkdir(targetPath);
    } catch {
      // Directory might already exist, that's fine
    }

    // Copy each item
    for (const item of items) {
      const sourceItemPath = `${sourcePath}/${item.name}`;
      const targetItemPath = `${targetPath}/${item.name}`;

      try {
        if (item.isDirectory()) {
          console.log(`Creating directory: ${targetItemPath}`);
          try {
            await targetFS.mkdir(targetItemPath);
          } catch {
            // Directory might already exist
          }
          // Recursively copy directory contents
          await copyFiles(sourceFS, targetFS, sourceItemPath, targetItemPath);
        } else {
          console.log(`Copying file: ${sourceItemPath} -> ${targetItemPath}`);
          const content = await sourceFS.readFile(sourceItemPath);
          await targetFS.writeFile(targetItemPath, content);
        }
      } catch (itemError) {
        console.warn(`Failed to copy item ${item.name}:`, itemError);
      }
    }

    console.log(`Successfully copied ${sourcePath} to ${targetPath}`);
  } catch (error) {
    console.error(`Failed to copy ${sourcePath}:`, error);
    throw error;
  }
}

/**
 * Copy a directory from JSRuntime filesystem to LightningFS
 * Convenience wrapper for copyFiles with better error handling
 */
export async function copyDirectory(
  sourceFS: JSRuntimeFS,
  targetFS: LightningFS.PromisifiedFS,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    // Check if source exists and is a directory
    const sourceStat = await sourceFS.stat(sourcePath);
    if (!sourceStat.isDirectory()) {
      throw new Error(`Source path ${sourcePath} is not a directory`);
    }

    await copyFiles(sourceFS, targetFS, sourcePath, targetPath);
  } catch (error) {
    console.error(`Failed to copy directory ${sourcePath} to ${targetPath}:`, error);
    throw error;
  }
}