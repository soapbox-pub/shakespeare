import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { generateUniqueFilename } from './fileUtils';

/**
 * Converts a File to a URL string for API consumption.
 * Tries useUploadFile first if available, otherwise falls back to data URL.
 * 
 * @param file - The file to convert
 * @param uploadFile - Optional upload function from useUploadFile hook
 * @returns Promise resolving to URL string
 */
export async function fileToUrl(
  file: File,
  uploadFile?: (file: File) => Promise<Array<[string, string] | string[]>>
): Promise<string> {
  // Try useUploadFile first if available
  if (uploadFile) {
    try {
      const tags = await uploadFile(file);
      // Extract URL from NIP-94 compatible tags
      // The first tag contains the URL
      if (tags && tags.length > 0 && tags[0]) {
        const firstTag = tags[0];
        // Handle both tuple [string, string] and array string[] formats
        if (Array.isArray(firstTag) && firstTag.length > 1) {
          return firstTag[1] as string;
        }
      }
    } catch (error) {
      console.warn('Failed to upload file via useUploadFile, falling back to data URL:', error);
      // Fall through to data URL fallback
    }
  }

  // Fallback to data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a URL to a file saved in the VFS.
 * Downloads an image from a URL and saves it to the VFS.
 * Returns both the original URL (for API calls) and the VFS path (for reference).
 * 
 * @param imageUrl - The image URL to download
 * @param fs - Filesystem instance for saving files
 * @param tmpPath - Temporary directory path for file storage
 * @returns Promise resolving to object with originalUrl and vfsPath, or null if download fails
 */
export async function urlToFile(
  imageUrl: string,
  fs: JSRuntimeFS,
  tmpPath = '/tmp'
): Promise<{ originalUrl: string; vfsPath: string } | null> {
  try {
    // Handle data URLs - extract and save them
    if (imageUrl.startsWith('data:image/')) {
      const [header, base64Data] = imageUrl.split(',');
      if (!base64Data) {
        console.warn('Invalid data URL format:', imageUrl);
        return null;
      }

      // Extract MIME type and extension from header
      const mimeMatch = header.match(/data:image\/([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'png';
      const extension = mimeType === 'jpeg' ? 'jpg' : mimeType;

      // Generate filename
      const filename = `downloaded_image_${Date.now()}.${extension}`;
      const uniqueFilename = await generateUniqueFilename(fs, tmpPath, filename);
      const vfsPath = `${tmpPath}/${uniqueFilename}`;

      // Convert base64 to Uint8Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Write to VFS
      await fs.writeFile(vfsPath, bytes);

      return { originalUrl: imageUrl, vfsPath };
    }

    // Handle HTTP/HTTPS URLs
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to download image from ${imageUrl}: ${response.status} ${response.statusText}`);
      return null;
    }

    // Determine filename from URL or Content-Type
    let filename = 'downloaded_image';
    const urlPath = new URL(imageUrl).pathname;
    const urlFilename = urlPath.split('/').pop();
    
    if (urlFilename && /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(urlFilename)) {
      filename = urlFilename;
    } else {
      // Try to get extension from Content-Type
      const contentType = response.headers.get('Content-Type');
      if (contentType?.startsWith('image/')) {
        const mimeType = contentType.split('/')[1];
        const extension = mimeType === 'jpeg' ? 'jpg' : mimeType;
        filename = `downloaded_image_${Date.now()}.${extension}`;
      } else {
        filename = `downloaded_image_${Date.now()}.png`;
      }
    }

    // Sanitize filename
    const sanitizedFilename = filename.replace(/\s+/g, '_');
    const uniqueFilename = await generateUniqueFilename(fs, tmpPath, sanitizedFilename);
    const vfsPath = `${tmpPath}/${uniqueFilename}`;

    // Read response as array buffer and convert to Uint8Array
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Write to VFS
    await fs.writeFile(vfsPath, uint8Array);

    return { originalUrl: imageUrl, vfsPath };
  } catch (error) {
    console.warn(`Error downloading image from ${imageUrl}:`, error);
    return null;
  }
}

