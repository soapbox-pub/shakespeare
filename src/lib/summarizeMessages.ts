import type { AIMessage } from './SessionManager';
import { createAIClient } from './ai-client';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { parseProviderModel } from './parseProviderModel';
import type { NUser } from '@nostrify/react/login';

/**
 * Summarize a conversation history into a single system message.
 * This is used for context compression to reduce token usage.
 */
export async function summarizeMessages(
  messages: AIMessage[],
  providerModel: string,
  aiSettings: { providers: AIProvider[] },
  user?: NUser,
): Promise<string> {
  // Parse provider and model
  const parsed = parseProviderModel(providerModel, aiSettings.providers);
  const provider = parsed.provider;
  const model = parsed.model;

  // Create AI client
  const openai = createAIClient(provider, user);

  // Create summarization prompt
  const summarizationPrompt = `You are a conversation summarizer. Your task is to create a concise summary of the following conversation between a user and an AI assistant building a software project.

The summary should:
1. Capture key decisions, features implemented, and important context
2. Preserve technical details like file paths, package names, and configuration changes
3. Be written in a clear, factual style
4. Focus on what was built and what the user wants, not the conversation flow
5. Be concise but comprehensive enough that the AI can continue the work seamlessly

Here is the conversation to summarize:

${messages.map((msg) => {
    if (msg.role === 'user') {
      const content = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map(part => part.type === 'text' ? part.text : '[image]').join('\n');
      return `USER: ${content}`;
    } else if (msg.role === 'assistant') {
      let text = `ASSISTANT: ${msg.content}`;
      if ('tool_calls' in msg && msg.tool_calls && msg.tool_calls.length > 0) {
        const toolNames = msg.tool_calls.map(tc => tc.type === 'function' ? tc.function.name : 'unknown').join(', ');
        text += ` [Used tools: ${toolNames}]`;
      }
      return text;
    } else if (msg.role === 'tool') {
      // Include abbreviated tool results for context
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
      return `TOOL RESULT: ${preview}`;
    }
    return '';
  }).join('\n\n')}

Now provide a comprehensive summary of this conversation. Focus on what has been built, what the user wants, and any important technical context. Do not include conversational filler or greetings.`;

  // Call AI to generate summary
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: summarizationPrompt,
      }
    ],
    temperature: 0.3, // Lower temperature for more factual summaries
  });

  const summary = response.choices[0]?.message?.content || '';

  if (!summary) {
    throw new Error('Failed to generate summary');
  }

  return summary;
}
