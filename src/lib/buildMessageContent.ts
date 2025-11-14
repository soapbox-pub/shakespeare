import type OpenAI from 'openai';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { parseImageUrls } from './parseImageUrls';
import { saveFileToTmp } from './fileUtils';

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage;

/**
 * Builds message content from text input, image URLs, and attached files.
 * Returns content as either a string (for simple text) or an array of content parts.
 * 
 * @param input - User text input that may contain image URLs
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

  // Parse user input to detect image URLs and split into content parts
  if (input.trim()) {
    const parsedParts = parseImageUrls(input.trim());
    contentParts.push(...parsedParts);
  }

  // Process attached files and add as separate text parts
  if (attachedFiles.length > 0) {
    const filePromises = attachedFiles.map(async (file) => {
      try {
        const savedPath = await saveFileToTmp(fs, file, tmpPath);
        return `Added file: ${savedPath}`;
      } catch (error) {
        console.error('Failed to save file:', error);
        return `Failed to save file: ${file.name}`;
      }
    });

    const fileResults = await Promise.all(filePromises);

    // Add each file as a separate text part
    fileResults.forEach(fileResult => {
      contentParts.push({
        type: 'text',
        text: fileResult
      });
    });
  }

  // Return as string if single text part, otherwise return array
  const hasImageUrls = contentParts.some(part => part.type === 'image_url');
  if (contentParts.length > 1 || hasImageUrls) {
    return contentParts;
  }
  
  if (contentParts.length === 1 && contentParts[0].type === 'text') {
    return contentParts[0].text;
  }
  
  return contentParts;
}

