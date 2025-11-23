import type OpenAI from 'openai';

/**
 * Detects image URLs in text and splits the text into content parts.
 * Image URLs are identified by common image file extensions or data URLs.
 * 
 * @param text - The input text that may contain image URLs
 * @returns Array of content parts (text and image_url types)
 */
export function parseImageUrls(
  text: string
): Array<OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage> {
  const trimmedText = text.trim();
  
  // Return empty array if input is empty
  if (!trimmedText) {
    return [];
  }

  // Regex to match URLs (http/https) that end with image extensions or are data URLs
  // Matches:
  // - http:// or https:// URLs ending with image extensions (jpg, jpeg, png, gif, webp, svg, bmp, ico)
  // - URLs with optional query parameters
  // - Data URLs (data:image/...;base64,...)
  const imageUrlRegex = /(https?:\/\/[^\s<>"']+\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?[^\s<>"']*)?|data:image\/[^;]+;base64,[^\s<>"']+)/gi;
  
  const parts: Array<OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  imageUrlRegex.lastIndex = 0;

  while ((match = imageUrlRegex.exec(trimmedText)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      const textBefore = trimmedText.substring(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push({
          type: 'text',
          text: textBefore
        });
      }
    }

    // Add the image URL
    const imageUrl = match[0];
    parts.push({
      type: 'image_url',
      image_url: {
        url: imageUrl
      }
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < trimmedText.length) {
    const textAfter = trimmedText.substring(lastIndex).trim();
    if (textAfter) {
      parts.push({
        type: 'text',
        text: textAfter
      });
    }
  }

  // If no URLs were found, return the original text as a single text part
  if (parts.length === 0) {
    return [{
      type: 'text',
      text: trimmedText
    }];
  }

  return parts;
}

