export interface ResizeOptions {
  /** Maximum width or height in pixels (default: 2048) */
  maxDimension?: number;
  /** Maximum file size in bytes (default: 5MB) */
  maxFileSize?: number;
  /** JPEG quality 0-1 (default: 0.92) */
  quality?: number;
}

/**
 * Resizes an image file if it exceeds size or dimension limits.
 * 
 * @param file - The image file to potentially resize
 * @param opts - Resize options with defaults
 * @returns Promise resolving to the original or resized File
 */
export async function resizeImageIfNeeded(file: File, opts: ResizeOptions = {}): Promise<File> {
  const {
    maxDimension = 2048,
    maxFileSize = 5 * 1024 * 1024, // 5MB
    quality = 0.92,
  } = opts;

  // Only process image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Check if resize is needed based on file size
  const needsResize = file.size > maxFileSize;

  if (!needsResize) {
    // Still need to check dimensions
    const dimensions = await getImageDimensions(file);
    if (dimensions.width <= maxDimension && dimensions.height <= maxDimension) {
      return file;
    }
  }

  // Resize the image
  return await resizeImage(file, maxDimension, quality);
}

/**
 * Gets the dimensions of an image file.
 * 
 * @param file - The image file
 * @returns Promise resolving to width and height
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Resizes an image to fit within maxDimension while maintaining aspect ratio.
 * 
 * @param file - The image file to resize
 * @param maxDimension - Maximum width or height
 * @param quality - JPEG quality 0-1
 * @returns Promise resolving to resized File
 */
async function resizeImage(file: File, maxDimension: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }

          // Create new File from blob with original name
          const resizedFile = new File([blob], file.name, {
            type: file.type || 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(resizedFile);
        },
        file.type || 'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = url;
  });
}

/**
 * Converts a File to a base64-encoded data URL for API consumption.
 *
 * @param file - The file to convert
 * @returns Promise resolving to base64 data URL string
 */
export async function fileToUrl(file: File): Promise<string> {
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

