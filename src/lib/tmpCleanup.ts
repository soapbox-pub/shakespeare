import type { JSRuntimeFS } from './JSRuntime';

/**
 * Recursively removes files and directories older than the specified age
 * @param fs - The filesystem instance
 * @param dirPath - The directory path to clean
 * @param maxAgeMs - Maximum age in milliseconds (files older than this will be removed)
 */
async function cleanupDirectory(fs: JSRuntimeFS, dirPath: string, maxAgeMs: number): Promise<void> {
  const now = Date.now();
  
  try {
    // Check if directory exists
    try {
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return;
      }
    } catch {
      // Directory doesn't exist, nothing to clean
      return;
    }

    // Get directory contents
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      
      try {
        const stat = await fs.stat(fullPath);
        const fileAge = now - (stat.mtimeMs || 0);
        
        if (fileAge > maxAgeMs) {
          if (entry.isDirectory()) {
            // Recursively clean subdirectory first, then remove it
            await cleanupDirectory(fs, fullPath, maxAgeMs);
            try {
              // Try to remove the directory (will only succeed if empty)
              await fs.rmdir(fullPath);
              console.log(`Removed old directory: ${fullPath}`);
            } catch {
              // Directory might not be empty, that's okay
            }
          } else if (entry.isFile()) {
            // Remove old file
            await fs.unlink(fullPath);
            console.log(`Removed old file: ${fullPath}`);
          }
        } else if (entry.isDirectory()) {
          // Directory is not old enough to remove, but clean its contents
          await cleanupDirectory(fs, fullPath, maxAgeMs);
        }
      } catch (error) {
        // Log error but continue with other files
        console.warn(`Failed to process ${fullPath}:`, error);
      }
    }
  } catch (error) {
    console.warn(`Failed to clean directory ${dirPath}:`, error);
  }
}

/**
 * Cleans up the /tmp directory by removing files older than 1 hour
 * @param fs - The filesystem instance
 */
export async function cleanupTmpDirectory(fs: JSRuntimeFS): Promise<void> {
  const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds
  const tmpPath = '/tmp';
  
  console.log('Starting /tmp directory cleanup...');
  
  try {
    await cleanupDirectory(fs, tmpPath, ONE_HOUR_MS);
    console.log('Completed /tmp directory cleanup');
  } catch (error) {
    console.error('Error during /tmp cleanup:', error);
  }
}