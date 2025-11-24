import type OpenAI from 'openai';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { saveFileToTmp } from './fileUtils';
import { fileToUrl } from './imageUtils';

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage;

/**
 * Builds message content from text input and attached files.
 *
 * - All image formats are included in the message content for UI display
 * - SessionManager filters to only pass JPG/JPEG/PNG to the OpenAI API
 * - All files are saved to VFS and get a text part with the path
 * - Images are converted to base64-encoded data URLs for API consumption
 *
 * Returns content as either a string (for simple text) or an array of content parts.
 *
 * @param input - User text input
 * @param attachedFiles - Array of files to attach
 * @param fs - Filesystem instance for saving files
 * @param tmpPath - Temporary directory path for file storage
 * @returns Promise resolving to message content (string or array of content parts)
 */
export async function buildMessageContent(
  input: string,
  attachedFiles: File[],
  fs: JSRuntimeFS,
  tmpPath = '/tmp'
): Promise<string | ContentPart[]> {
  const contentParts: ContentPart[] = [];

  // Add user input as text part if present
  if (input.trim()) {
    contentParts.push({
      type: 'text',
      text: input.trim()
    });
  }

  // Process attached files: save to VFS and add image_url for UI display (all image types)
  if (attachedFiles.length > 0) {
    const filePromises = attachedFiles.map(async (file) => {
      try {
        // Save file to VFS (always do this)
        const savedPath = await saveFileToTmp(fs, file, tmpPath);

        // Always add text part with VFS path
        const textPart: ContentPart = {
          type: 'text',
          text: `Added file: ${savedPath}`
        };

        // For all image types, also add as image_url for UI display with base64 encoding
        const isImage = file.type.startsWith('image/');
        if (isImage) {
          try {
            const imageUrl = await fileToUrl(file);
            // Return both parts: image_url for UI display and text for VFS path
            return [textPart, {
              type: 'image_url' as const,
              image_url: { url: imageUrl }
            }];
          } catch (error) {
            // If URL conversion fails, just use text part
            console.warn('Failed to convert image to base64, using text part only:', error);
          }
        }

        return [textPart];
      } catch (error) {
        console.error('Failed to save file:', error);
        return [{
          type: 'text' as const,
          text: `Failed to save file: ${file.name}`
        }];
      }
    });

    const fileResults = await Promise.all(filePromises);

    // Flatten the results (each file can return multiple parts)
    for (const parts of fileResults) {
      contentParts.push(...parts);
    }
  }

  // Return as string if single text part, otherwise return array
  if (contentParts.length === 1 && contentParts[0].type === 'text') {
    return contentParts[0].text;
  }

  // Return array for multiple parts or if contains image URLs
  return contentParts;
}

