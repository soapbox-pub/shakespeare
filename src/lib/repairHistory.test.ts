import { describe, it, expect } from 'vitest';
import type OpenAI from 'openai';
import { INTERRUPTED_TOOL_RESULT, isHistoryGapNotice, makeHistoryGapNotice, repairHistory } from './repairHistory';
import { isSystemReminder, makeSystemReminder } from './systemReminder';

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const call = (...ids: string[]): Message => ({
  role: 'assistant',
  content: '',
  tool_calls: ids.map((id) => ({ id, type: 'function', function: { name: 'shell', arguments: '{}' } })),
});
const result = (id: string, content = `result ${id}`): Message => ({ role: 'tool', tool_call_id: id, content });
const user = (content: string): Message => ({ role: 'user', content });
const assistant = (content: string): Message => ({ role: 'assistant', content });
const notice = makeHistoryGapNotice();

describe('repairHistory', () => {
  it('returns a valid history unchanged', () => {
    const messages = [user('hi'), call('a', 'b'), result('a'), result('b'), assistant('done'), user('more')];
    const repaired = repairHistory(messages);
    expect(repaired.repaired).toBe(false);
    expect(repaired.messages).toBe(messages);
  });

  it('leaves trailing tool calls open, since they may still be running', () => {
    const messages = [user('hi'), call('a', 'b'), result('a')];
    expect(repairHistory(messages).messages).toBe(messages);
  });

  it('answers trailing tool calls when asked to', () => {
    const repaired = repairHistory([user('hi'), call('a', 'b'), result('a')], { closeTrailing: true });
    expect(repaired.messages).toEqual([
      user('hi'), call('a', 'b'), result('a'), result('b', INTERRUPTED_TOOL_RESULT), notice,
    ]);
  });

  it('answers tool calls the conversation moved on from, and marks the gap', () => {
    const repaired = repairHistory([user('hi'), call('a'), user('stop that'), assistant('ok')]);
    expect(repaired.repaired).toBe(true);
    expect(repaired.messages).toEqual([
      user('hi'), call('a'), result('a', INTERRUPTED_TOOL_RESULT), notice, user('stop that'), assistant('ok'),
    ]);
  });

  it('drops a tool result that arrived after the next turn started', () => {
    // A stopped image generation finishing after the user sent another message
    const repaired = repairHistory([
      user('draw'), call('img'), user('never mind'), assistant('sure'), result('img'), user('thanks'),
    ]);
    expect(repaired.messages).toEqual([
      user('draw'), call('img'), result('img', INTERRUPTED_TOOL_RESULT), notice,
      user('never mind'), assistant('sure'), user('thanks'),
    ]);
  });

  it('drops tool results without an id or for a call that was already answered', () => {
    const missingId = { role: 'tool', content: 'x' } as Message;
    const repaired = repairHistory([user('hi'), call('a'), result('a'), result('a'), missingId, assistant('done')]);
    expect(repaired.messages).toEqual([user('hi'), call('a'), result('a'), notice, assistant('done')]);
  });

  it('puts the notice before open tool calls instead of between them and their results', () => {
    const repaired = repairHistory([user('hi'), assistant('hello'), result('stray'), call('b')]);
    expect(repaired.messages).toEqual([user('hi'), assistant('hello'), notice, call('b')]);
  });

  it('is idempotent', () => {
    const once = repairHistory([user('draw'), call('img'), user('again'), result('img'), call('c')]).messages;
    const twice = repairHistory(once);
    expect(twice.repaired).toBe(false);
    expect(twice.messages).toBe(once);
  });
});

describe('isHistoryGapNotice', () => {
  it('recognises the notice, which is also a system reminder', () => {
    expect(isHistoryGapNotice(notice)).toBe(true);
    expect(isSystemReminder(notice)).toBe(true);
  });

  it('rejects other reminders and messages', () => {
    expect(isHistoryGapNotice(makeSystemReminder('The current date is now Monday.'))).toBe(false);
    expect(isHistoryGapNotice(user('hello'))).toBe(false);
  });
});
