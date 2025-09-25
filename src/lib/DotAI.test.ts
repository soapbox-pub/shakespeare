import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DotAI } from './DotAI';
import type { JSRuntimeFS } from './JSRuntime';
import type OpenAI from 'openai';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  lstat: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
  rename: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
});

describe('DotAI', () => {
  let mockFS: JSRuntimeFS;
  let dotAI: DotAI;

  beforeEach(() => {
    mockFS = createMockFS();
    dotAI = new DotAI(mockFS, '/test-project');
  });

  describe('readLastSessionHistory', () => {
    it('should return null when history directory does not exist', async () => {
      // Mock historyDirExists to return false
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(false);

      const result = await dotAI.readLastSessionHistory();
      expect(result).toBeNull();
    });

    it('should return null when no session files exist', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      // Mock readdir to return empty array
      vi.mocked(mockFS.readdir).mockResolvedValue([]);

      const result = await dotAI.readLastSessionHistory();
      expect(result).toBeNull();
    });

    it('should return messages and session name from most recent file', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      // Mock readdir to return session files
      vi.mocked(mockFS.readdir).mockResolvedValue([
        '2024-08-24T16-30-45Z-abc.jsonl',
        '2024-08-24T17-15-22Z-def.jsonl', // This should be the most recent
        '2024-08-24T15-00-00Z-xyz.jsonl'
      ]);

      // Mock readFile to return JSONL content
      const mockContent = `{"role":"user","content":"Hello"}
{"role":"assistant","content":"Hi there!"}`;
      vi.mocked(mockFS.readFile).mockResolvedValue(mockContent);

      const result = await dotAI.readLastSessionHistory();

      expect(result).not.toBeNull();
      expect(result?.sessionName).toBe('2024-08-24T17-15-22Z-def');
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result?.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should handle malformed JSON lines gracefully', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      // Mock readdir to return session files
      vi.mocked(mockFS.readdir).mockResolvedValue(['session.jsonl']);

      // Mock readFile to return content with malformed JSON
      const mockContent = `{"role":"user","content":"Hello"}
invalid json line
{"role":"assistant","content":"Hi there!"}`;
      vi.mocked(mockFS.readFile).mockResolvedValue(mockContent);

      const result = await dotAI.readLastSessionHistory();

      expect(result).not.toBeNull();
      expect(result?.messages).toHaveLength(2); // Should skip the malformed line
      expect(result?.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result?.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });
  });

  describe('setHistory', () => {
    it('should create history directory if it does not exist', async () => {
      // Mock historyDirExists to return false initially
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(false);
      // Mock setupAiHistoryDir
      vi.spyOn(dotAI, 'setupAiHistoryDir').mockResolvedValue();

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' }
      ];

      await dotAI.setHistory('test-session', messages);

      // Verify setupAiHistoryDir was called
      expect(dotAI.setupAiHistoryDir).toHaveBeenCalled();
    });

    it('should write messages as JSONL format', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      await dotAI.setHistory('test-session', messages);

      // Verify writeFile was called with correct content
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test-project/.ai/history/test-session.jsonl',
        '{"role":"user","content":"Hello"}\n{"role":"assistant","content":"Hi there!"}\n'
      );
    });

    it('should handle empty messages array', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      await dotAI.setHistory('test-session', []);

      // Verify writeFile was called with empty content
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test-project/.ai/history/test-session.jsonl',
        ''
      );
    });

    it('should handle write errors gracefully', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);
      // Mock writeFile to throw an error
      vi.mocked(mockFS.writeFile).mockRejectedValue(new Error('Write failed'));

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: 'user', content: 'Hello' }];

      // Should not throw
      await expect(dotAI.setHistory('test-session', messages)).resolves.toBeUndefined();
    });

    it('should validate tool messages have matching tool_call_id', async () => {
      const validMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: 'I need to use a tool',
          tool_calls: [{ id: 'call_123', type: 'function', function: { name: 'test_tool', arguments: '{}' } }]
        },
        { role: 'tool', content: 'Tool result', tool_call_id: 'call_123' }
      ];

      // Should not throw for valid messages
      await expect(dotAI.setHistory('test-session', validMessages)).resolves.toBeUndefined();
    });

    it('should throw error for tool message without preceding assistant message with tool_calls', async () => {
      const invalidMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Response without tool calls' },
        { role: 'tool', content: 'Tool result', tool_call_id: 'call_123' }
      ];

      await expect(dotAI.setHistory('test-session', invalidMessages))
        .rejects.toThrow('Tool message at index 2 with tool_call_id "call_123" must be preceded by an assistant message with a matching tool_call id');
    });

    it('should throw error for tool message with non-matching tool_call_id', async () => {
      const invalidMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: 'I need to use a tool',
          tool_calls: [{ id: 'call_456', type: 'function', function: { name: 'test_tool', arguments: '{}' } }]
        },
        { role: 'tool', content: 'Tool result', tool_call_id: 'call_123' }
      ];

      await expect(dotAI.setHistory('test-session', invalidMessages))
        .rejects.toThrow('Tool message at index 2 with tool_call_id "call_123" must be preceded by an assistant message with a matching tool_call id');
    });

    it('should throw error for tool message without tool_call_id', async () => {
      const invalidMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: 'I need to use a tool',
          tool_calls: [{ id: 'call_123', type: 'function', function: { name: 'test_tool', arguments: '{}' } }]
        },
        { role: 'tool', content: 'Tool result' } as OpenAI.Chat.Completions.ChatCompletionMessageParam
      ];

      await expect(dotAI.setHistory('test-session', invalidMessages))
        .rejects.toThrow('Tool message at index 2 is missing tool_call_id');
    });

    it('should validate multiple tool messages correctly', async () => {
      const validMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'assistant',
          content: 'I need to use tools',
          tool_calls: [
            { id: 'call_123', type: 'function', function: { name: 'tool1', arguments: '{}' } },
            { id: 'call_456', type: 'function', function: { name: 'tool2', arguments: '{}' } }
          ]
        },
        { role: 'tool', content: 'Tool 1 result', tool_call_id: 'call_123' },
        { role: 'tool', content: 'Tool 2 result', tool_call_id: 'call_456' }
      ];

      // Should not throw for valid messages
      await expect(dotAI.setHistory('test-session', validMessages)).resolves.toBeUndefined();
    });

    it('should allow tool messages to reference tool calls from the most recent assistant message', async () => {
      const validMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'First request' },
        {
          role: 'assistant',
          content: 'First response',
          tool_calls: [{ id: 'call_old', type: 'function', function: { name: 'old_tool', arguments: '{}' } }]
        },
        { role: 'tool', content: 'Old tool result', tool_call_id: 'call_old' },
        { role: 'user', content: 'Second request' },
        {
          role: 'assistant',
          content: 'Second response',
          tool_calls: [{ id: 'call_new', type: 'function', function: { name: 'new_tool', arguments: '{}' } }]
        },
        { role: 'tool', content: 'New tool result', tool_call_id: 'call_new' }
      ];

      // Should not throw for valid messages
      await expect(dotAI.setHistory('test-session', validMessages)).resolves.toBeUndefined();
    });
  });

  describe('generateSessionName', () => {
    it('should generate a unique session name', () => {
      const sessionName1 = DotAI.generateSessionName();
      const sessionName2 = DotAI.generateSessionName();

      expect(sessionName1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-z0-9]{3}$/);
      expect(sessionName2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-z0-9]{3}$/);
      expect(sessionName1).not.toBe(sessionName2);
    });
  });
});