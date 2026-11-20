export interface ResizeOptions {
  /** Maximum width or height in pixels (default: 2048) */
  maxDimension?: number;
  /** Maximum file size in bytes (default: 5MB) */
  maxFileSize?: number;
  /** JPEG quality 0-1 (default: 0.92) */
  quality?: number;
}

/**
 * Whether there's a DOM to decode and draw images with. Without one (in the
 * service worker, where the assistant can run), `createImageBitmap` and
 * `OffscreenCanvas` do the same work.
 */
const hasDOM = typeof document !== 'undefined' && typeof Image !== 'undefined';

/** A decoded image, from an `<img>` or `createImageBitmap`. */
type DecodedImage = HTMLImageElement | ImageBitmap;

/** A canvas to draw on, and how to read it back as a file. */
interface DrawingSurface {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  toBlob(type: string, quality?: number): Promise<Blob | null>;
}

function createSurface(width: number, height: number): DrawingSurface {
  if (hasDOM) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    return { ctx, toBlob: (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality)) };
  }
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  return { ctx, toBlob: (type, quality) => canvas.convertToBlob({ type, quality }) };
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
  const img = await loadImage(file);
  const dimensions = { width: img.width, height: img.height };
  if (!hasDOM) (img as ImageBitmap).close();
  return dimensions;
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
  let img: DecodedImage;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error('Failed to load image for resizing');
  }

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

  // Draw the resized image
  const surface = createSurface(Math.round(width), Math.round(height));
  surface.ctx.drawImage(img, 0, 0, width, height);
  if (!hasDOM) (img as ImageBitmap).close();

  const blob = await surface.toBlob(type, quality);
  if (!blob) {
    throw new Error('Failed to create blob from canvas');
  }

  // Create new File from blob with original name
  return new File([blob], file.name, {
    type: blob.type,
    lastModified: Date.now(),
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

  const surface = createSurface(width * scale, height * scale);
  surface.ctx.imageSmoothingEnabled = false;
  surface.ctx.drawImage(img, x, y, width, height, 0, 0, width * scale, height * scale);
  if (!hasDOM) (img as ImageBitmap).close();

  const blob = await surface.toBlob('image/png');
  if (!blob) {
    throw new Error('Failed to create blob from canvas');
  }

  return {
    file: new File([blob], file.name.replace(/\.[^.]*$/, '') + '-crop.png', { type: 'image/png' }),
    region: { x, y, width, height },
    scale,
  };
}

function loadImage(file: File): Promise<DecodedImage> {
  if (!hasDOM) {
    return createImageBitmap(file).catch(() => {
      throw new Error('Failed to load image');
    });
  }
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
  if (typeof FileReader === 'undefined') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
  }
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
