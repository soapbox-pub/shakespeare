import OpenAI from "openai";

export function assistantContentEmpty(
  content: OpenAI.ChatCompletionAssistantMessageParam['content'],
): boolean {
  if (!content) return true;
  const text: string[] = [];

  if (typeof content === 'string') {
    text.push(content);
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text') {
        text.push(part.text);
      }
    }
  }

  const result = text.join('\n\n');
  return !result.trim();
}