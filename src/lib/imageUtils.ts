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
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
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

/** Image types that every vision API accepts. */
const API_IMAGE_TYPES = ['image/png', 'image/jpeg'];

/**
 * Converts an image to PNG unless it is already a type every vision API accepts.
 * WebP, GIF, BMP, etc. would otherwise be dropped before reaching the model.
 *
 * @param file - The image file
 * @returns Promise resolving to the original file, or a PNG copy of it
 */
export async function toApiImage(file: File): Promise<File> {
  if (API_IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  const { width, height } = await getImageDimensions(file);
  return await resizeImage(file, Math.max(width, height), 1, 'image/png');
}

/**
 * Resizes an image to fit within maxDimension while maintaining aspect ratio.
 * 
 * @param file - The image file to resize
 * @param maxDimension - Maximum width or height
 * @param quality - JPEG quality 0-1
 * @param type - Output MIME type (defaults to the file's own type)
 * @returns Promise resolving to resized File
 */
async function resizeImage(file: File, maxDimension: number, quality: number, type = file.type || 'image/jpeg'): Promise<File> {
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
            type: blob.type,
            lastModified: Date.now(),
          });

          resolve(resizedFile);
        },
        type,
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

export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crops an image to a region and enlarges it, so fine detail survives the
 * downscaling vision models apply. Enlarging uses nearest-neighbor sampling,
 * so individual pixels stay sharp.
 *
 * @param file - The image file
 * @param region - The region to keep, in the image's pixels (clamped to the image)
 * @param minSize - Enlarge until the longer side is at least this many pixels
 * @param maxScale - Never enlarge more than this
 * @returns Promise resolving to a PNG of the region, the clamped region, and the scale used
 */
export async function cropImage(
  file: File,
  region: ImageRegion,
  minSize = 1024,
  maxScale = 8,
): Promise<{ file: File; region: ImageRegion; scale: number }> {
  const img = await loadImage(file);

  const x = Math.max(0, Math.min(Math.floor(region.x), img.width - 1));
  const y = Math.max(0, Math.min(Math.floor(region.y), img.height - 1));
  const width = Math.max(1, Math.min(Math.ceil(region.width), img.width - x));
  const height = Math.max(1, Math.min(Math.ceil(region.height), img.height - y));

  const scale = Math.max(1, Math.min(maxScale, Math.floor(minSize / Math.max(width, height))));

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('Failed to create blob from canvas');
  }

  return {
    file: new File([blob], file.name.replace(/\.[^.]*$/, '') + '-crop.png', { type: 'image/png' }),
    region: { x, y, width, height },
    scale,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
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

