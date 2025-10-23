import type { JSRuntimeFS } from '@/lib/JSRuntime';

/**
 * Generate a unique filename by adding numbers if the file already exists
 * @param fs - Filesystem instance
 * @param directory - Directory to check for existing files
 * @param filename - Original filename
 * @returns Promise<string> - Unique filename
 */
export async function generateUniqueFilename(
  fs: JSRuntimeFS,
  directory: string,
  filename: string
): Promise<string> {
  // Ensure directory exists
  try {
    await fs.mkdir(directory, { recursive: true });
  } catch {
    // Directory might already exist, continue
  }

  // Parse filename and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
  const extension = lastDotIndex === -1 ? '' : filename.slice(lastDotIndex);

  let uniqueFilename = filename;
  let counter = 1;

  // Keep checking for existing files and increment counter
  while (true) {
    const fullPath = `${directory}/${uniqueFilename}`;

    try {
      await fs.stat(fullPath);
      // File exists, try next number
      uniqueFilename = `${name}_${counter}${extension}`;
      counter++;
    } catch {
      // File doesn't exist, we can use this filename
      break;
    }
  }

  return uniqueFilename;
}

/**
 * Save a file to the tmp directory with deduplication
 * @param fs - Filesystem instance
 * @param file - File object to save
 * @param tmpPath - Custom tmp path (default: /tmp)
 * @returns Promise<string> - Full path where the file was saved
 */
export async function saveFileToTmp(fs: JSRuntimeFS, file: File, tmpPath = '/tmp'): Promise<string> {
  const tmpDir = tmpPath;
  // Convert spaces to underscores in the filename
  const sanitizedFilename = file.name.replace(/\s+/g, '_');
  const uniqueFilename = await generateUniqueFilename(fs, tmpDir, sanitizedFilename);
  const fullPath = `${tmpDir}/${uniqueFilename}`;

  // Read file content as array buffer and convert to Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Write file to filesystem
  await fs.writeFile(fullPath, uint8Array);

  return fullPath;
}