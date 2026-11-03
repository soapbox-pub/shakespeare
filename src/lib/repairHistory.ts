import type OpenAI from 'openai';
import { isSystemReminder, makeSystemReminder } from './systemReminder';

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam | {
  role: string;
  content?: unknown;
  tool_calls?: Array<{ id: string }>;
  tool_call_id?: string;
};

/** What a tool call that never got a result is answered with, so the conversation stays valid. */
export const INTERRUPTED_TOOL_RESULT = 'No result was recorded for this tool call: it was interrupted before it finished.';

/** What a tool call the user stopped is answered with. */
export const CANCELLED_TOOL_RESULT = 'Cancelled: the user stopped the AI before this tool call finished.';

const GAP_NOTICE_TEXT =
  'Some messages in this conversation were lost or interrupted at this point, so earlier tool calls may be missing their results. ' +
  'Do not assume their changes were made: check the files before relying on them.';

/** A reminder marking where messages were lost. The model reads it; the chat shows it as a divider. */
export function makeHistoryGapNotice(): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
  return makeSystemReminder(GAP_NOTICE_TEXT);
}

/** Whether a message is the notice marking where messages were lost */
export function isHistoryGapNotice(message: { role: string; content?: unknown }): boolean {
  return isSystemReminder(message) && typeof message.content === 'string' && message.content.includes(GAP_NOTICE_TEXT);
}

export interface RepairOptions {
  /**
   * Answer tool calls at the end of the history that have no result yet. Only right when nothing
   * is running them, e.g. when loading a history whose turn was cut off by a reload.
   */
  closeTrailing?: boolean;
}

export interface RepairResult<T> {
  messages: T[];
  /** Whether anything was changed */
  repaired: boolean;
}

/**
 * Make a history valid to send: every tool result follows the assistant message that called it,
 * and every tool call has a result before the conversation moves on.
 *
 * Tool results that don't belong to the preceding tool calls are dropped, and tool calls that the
 * conversation moved on from without a result are answered with {@link INTERRUPTED_TOOL_RESULT}.
 * Either way a {@link makeHistoryGapNotice} is inserted where it happened, so both the user and the
 * model know something is missing. A valid history is returned unchanged (the same array).
 */
export function repairHistory<T extends Message>(messages: T[], options: RepairOptions = {}): RepairResult<T> {
  const result: T[] = [];
  let repaired = false;
  let noticePending = false;

  // Tool calls of the latest assistant message that haven't been answered yet, and where it is
  let open: string[] = [];
  let openIndex = -1;
  // Calls answered here as interrupted. Their late results belong to a gap that's already marked.
  const interrupted = new Set<string>();

  const closeOpen = () => {
    for (const id of open) {
      interrupted.add(id);
      result.push({ role: 'tool', tool_call_id: id, content: INTERRUPTED_TOOL_RESULT } as T);
      repaired = true;
      noticePending = true;
    }
    open = [];
    openIndex = -1;
  };

  const placeNotice = () => {
    if (!noticePending) return;
    noticePending = false;
    if (result.length > 0 && isHistoryGapNotice(result[result.length - 1])) return;
    result.push(makeHistoryGapNotice() as T);
  };

  for (const message of messages) {
    if (message.role === 'tool') {
      const id = 'tool_call_id' in message ? message.tool_call_id : undefined;
      const index = id ? open.indexOf(id) : -1;
      if (index === -1) {
        // A result for a call that isn't waiting for one (late, duplicated, or its call was lost)
        repaired = true;
        if (!id || !interrupted.has(id)) noticePending = true;
        continue;
      }
      open.splice(index, 1);
      result.push(message);
      continue;
    }

    // The conversation moves on: unanswered calls were interrupted
    closeOpen();
    placeNotice();

    result.push(message);

    if (message.role === 'assistant' && 'tool_calls' in message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      open = message.tool_calls.map((call) => call.id);
      openIndex = result.length - 1;
    }
  }

  if (options.closeTrailing) {
    closeOpen();
  }

  if (noticePending) {
    if (open.length > 0) {
      // The trailing tool calls may still be running, so the notice can't go after them.
      // It goes before the assistant message that made them, between turns.
      if (!(openIndex > 0 && isHistoryGapNotice(result[openIndex - 1]))) {
        result.splice(openIndex, 0, makeHistoryGapNotice() as T);
      }
      noticePending = false;
    } else {
      placeNotice();
    }
  }

  return repaired ? { messages: result, repaired } : { messages, repaired };
}
