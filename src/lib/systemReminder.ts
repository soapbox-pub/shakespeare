import type OpenAI from 'openai';
import { editWithShakespeareUrls, type PromptEnvironment } from './system';

const OPEN = '<system-reminder>';
const CLOSE = '</system-reminder>';

/**
 * A user message that tells the model something changed since the system prompt was written.
 * It is stored in the history like any other message, so the prompt and everything before it
 * stay byte-identical for prompt caching, and it is hidden from the chat UI.
 */
export function makeSystemReminder(text: string): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
  return { role: 'user', content: `${OPEN}\n${text}\n${CLOSE}` };
}

/** Whether a message is entirely a system reminder (and so not something the user wrote) */
export function isSystemReminder(message: { role: string; content?: unknown }): boolean {
  if (message.role !== 'user' || typeof message.content !== 'string') return false;
  const text = message.content.trim();
  return text.startsWith(OPEN) && text.endsWith(CLOSE) && text.indexOf(OPEN, OPEN.length) === -1;
}

/** Describe how the environment changed since the system prompt stated it, or undefined if it didn't */
export function describeEnvironmentChanges(before: PromptEnvironment, after: PromptEnvironment): string | undefined {
  const lines: string[] = [];

  if (after.date !== before.date) {
    lines.push(`The current date is now ${after.date}.`);
  }

  if (after.deployedUrl !== before.deployedUrl) {
    lines.push(after.deployedUrl
      ? `The project is now deployed at ${after.deployedUrl}.`
      : 'The project is no longer deployed.');
  }

  if (after.repositoryUrl !== before.repositoryUrl) {
    if (after.repositoryUrl) {
      const { badgeUrl, editUrl } = editWithShakespeareUrls(after.repositoryUrl);
      lines.push(
        `The project's repository URL is now ${after.repositoryUrl}.`,
        `An "Edit with Shakespeare" button can now be created: [![Edit with Shakespeare](${badgeUrl})](${editUrl})`,
      );
    } else {
      lines.push('The project no longer has a repository URL.');
    }
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}
