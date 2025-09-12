import type { JSRuntimeFS } from './JSRuntime';

/**
 * Copy files and directories between two filesystem instances
 * @param sourceFS Source filesystem
 * @param targetFS Target filesystem
 * @param sourcePath Source directory path
 * @param targetPath Target directory path
 */
export async function copyFiles(
  sourceFS: JSRuntimeFS,
  targetFS: JSRuntimeFS,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    console.log(`Copying: ${sourcePath} -> ${targetPath}`);

    // Get source directory contents
    const items = await sourceFS.readdir(sourcePath, { withFileTypes: true });
    console.log(`Found ${items.length} items in ${sourcePath}`);

    // Ensure target directory exists
    try {
      await targetFS.mkdir(targetPath, { recursive: true });
    } catch {
      // Directory might already exist, that's fine
    }

    // Copy each item in parallel
    await Promise.all(
      items.map(async (item) => {
        const sourceItemPath = `${sourcePath}/${item.name}`;
        const targetItemPath = `${targetPath}/${item.name}`;

        try {
          if (item.isDirectory()) {
            console.log(`Creating directory: ${targetItemPath}`);
            try {
              await targetFS.mkdir(targetItemPath, { recursive: true });
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
      })
    );

    console.log(`Successfully copied ${sourcePath} to ${targetPath}`);
  } catch (error) {
    console.error(`Failed to copy ${sourcePath}:`, error);
    throw error;
  }
}

/**
 * Copy a single file between JSRuntime filesystems
 * @param sourceFS Source filesystem
 * @param targetFS Target filesystem
 * @param sourcePath Source file path
 * @param targetPath Target file path
 */
export async function copyFile(
  sourceFS: JSRuntimeFS,
  targetFS: JSRuntimeFS,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    console.log(`Copying file: ${sourcePath} -> ${targetPath}`);

    // Check if source exists and is a file
    const sourceStat = await sourceFS.stat(sourcePath);
    if (!sourceStat.isFile()) {
      throw new Error(`Source path ${sourcePath} is not a file`);
    }

    // Read the file content
    const content = await sourceFS.readFile(sourcePath);

    // Write to target
    await targetFS.writeFile(targetPath, content);

    console.log(`Successfully copied file ${sourcePath} to ${targetPath}`);
  } catch (error) {
    console.error(`Failed to copy file ${sourcePath} to ${targetPath}:`, error);
    throw error;
  }
}

/**
 * Copy a directory between JSRuntime filesystems
 * Convenience wrapper for copyFiles with better error handling
 */
export async function copyDirectory(
  sourceFS: JSRuntimeFS,
  targetFS: JSRuntimeFS,
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