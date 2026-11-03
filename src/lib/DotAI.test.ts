import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DotAI } from './DotAI';
import type { JSRuntimeFS } from './JSRuntime';
import type OpenAI from 'openai';
import { isHistoryGapNotice } from './repairHistory';

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

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' }
      ];

      await dotAI.setHistory('test-session', messages);

      // Verify mkdir was called with recursive option
      expect(mockFS.mkdir).toHaveBeenCalledWith('/test-project/.git/ai/history', { recursive: true });
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
        '/test-project/.git/ai/history/test-session.jsonl',
        '{"role":"user","content":"Hello"}\n{"role":"assistant","content":"Hi there!"}\n'
      );
    });

    it('should handle empty messages array', async () => {
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      await dotAI.setHistory('test-session', []);

      // Verify writeFile was called with empty content
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test-project/.git/ai/history/test-session.jsonl',
        ''
      );
    });

    it('should throw when the file cannot be written', async () => {
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);
      vi.mocked(mockFS.writeFile).mockRejectedValue(new Error('Write failed'));

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: 'user', content: 'Hello' }];

      await expect(dotAI.setHistory('test-session', messages)).rejects.toThrow('Write failed');
    });

    it('should save a valid history as it is', async () => {
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
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

      await dotAI.setHistory('test-session', messages);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test-project/.git/ai/history/test-session.jsonl',
        messages.map((message) => JSON.stringify(message)).join('\n') + '\n',
      );
    });

    it('should save a broken history repaired instead of refusing to save it', async () => {
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Response without tool calls' },
        { role: 'tool', content: 'Stray tool result', tool_call_id: 'call_123' },
        { role: 'user', content: 'Next' },
      ];

      await dotAI.setHistory('test-session', messages);

      const written = vi.mocked(mockFS.writeFile).mock.calls[0][1] as string;
      const saved = written.trim().split('\n').map((line) => JSON.parse(line));
      expect(saved.map((message) => message.role)).toEqual(['user', 'assistant', 'user', 'user']);
      expect(saved[2]).toSatisfy(isHistoryGapNotice);
      expect(saved[3]).toEqual({ role: 'user', content: 'Next' });
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

  describe('readCost', () => {
    it('should return 0 when COST file does not exist', async () => {
      vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

      const cost = await dotAI.readCost();
      expect(cost).toBe(0);
    });

    it('should read and parse cost from COST file', async () => {
      vi.mocked(mockFS.readFile).mockResolvedValue('0.123456\n');

      const cost = await dotAI.readCost();
      expect(cost).toBe(0.123456);
    });

    it('should return 0 for invalid cost value', async () => {
      vi.mocked(mockFS.readFile).mockResolvedValue('invalid\n');

      const cost = await dotAI.readCost();
      expect(cost).toBe(0);
    });

    it('should handle cost with whitespace', async () => {
      vi.mocked(mockFS.readFile).mockResolvedValue('  0.050000  \n');

      const cost = await dotAI.readCost();
      expect(cost).toBe(0.05);
    });
  });

  describe('writeCost', () => {
    it('should create shakespeare directory if it does not exist', async () => {
      await dotAI.writeCost(0.123456);

      expect(mockFS.mkdir).toHaveBeenCalledWith('/test-project/.git/shakespeare', { recursive: true });
    });

    it('should write cost with 6 decimal places', async () => {
      await dotAI.writeCost(0.123456789);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test-project/.git/shakespeare/COST',
        '0.123457\n'
      );
    });

    it('should write zero cost correctly', async () => {
      await dotAI.writeCost(0);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        '/test-project/.git/shakespeare/COST',
        '0.000000\n'
      );
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(mockFS.writeFile).mockRejectedValue(new Error('Write failed'));

      // Should not throw
      await expect(dotAI.writeCost(0.123456)).resolves.toBeUndefined();
    });
  });
});