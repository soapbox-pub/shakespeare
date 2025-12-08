/**
 * Error thrown when image generation fails
 */
export class ImageGenerationError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'ImageGenerationError';
  }
}
