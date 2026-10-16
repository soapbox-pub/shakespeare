import type OpenAI from 'openai';

const ADDED_FILE = /^Added file: \/\S+$/;

/**
 * The text a user typed, without image parts or the "Added file: <path>" parts for their attachments.
 */
export function userMessageText(content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPart>): string {
  if (typeof content === 'string') return content;

  return content
    .filter((part): part is OpenAI.Chat.Completions.ChatCompletionContentPartText => part.type === 'text')
    .map((part) => part.text)
    .filter((text) => !ADDED_FILE.test(text))
    .join('\n\n');
}

/** How many attachments a user message carries. */
export function userMessageAttachments(content: string | Array<OpenAI.Chat.Completions.ChatCompletionContentPart>): number {
  if (typeof content === 'string') return 0;
  return content.filter((part) => part.type === 'text' && ADDED_FILE.test(part.text)).length;
}
