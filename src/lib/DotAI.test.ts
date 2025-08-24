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
    it('should return null when AI is not enabled', async () => {
      // Mock isEnabled to return false
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(false);

      const result = await dotAI.readLastSessionHistory();
      expect(result).toBeNull();
    });

    it('should return null when history directory does not exist', async () => {
      // Mock isEnabled to return true but historyDirExists to return false
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(false);

      const result = await dotAI.readLastSessionHistory();
      expect(result).toBeNull();
    });

    it('should return null when no session files exist', async () => {
      // Mock isEnabled and historyDirExists to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);

      // Mock readdir to return empty array
      vi.mocked(mockFS.readdir).mockResolvedValue([]);

      const result = await dotAI.readLastSessionHistory();
      expect(result).toBeNull();
    });

    it('should return messages and session name from most recent file', async () => {
      // Mock isEnabled and historyDirExists to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
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
      // Mock isEnabled and historyDirExists to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
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
    it('should not save when AI is not enabled', async () => {
      // Mock isEnabled to return false
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(false);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      await dotAI.setHistory('test-session', messages);

      // Verify writeFile was not called
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('should create history directory if it does not exist', async () => {
      // Mock isEnabled to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
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
      // Mock isEnabled to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
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
      // Mock isEnabled to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
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
      // Mock isEnabled to return true
      vi.spyOn(dotAI, 'isEnabled').mockResolvedValue(true);
      // Mock historyDirExists to return true
      vi.spyOn(dotAI, 'historyDirExists').mockResolvedValue(true);
      // Mock writeFile to throw an error
      vi.mocked(mockFS.writeFile).mockRejectedValue(new Error('Write failed'));

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: 'user', content: 'Hello' }];

      // Should not throw
      await expect(dotAI.setHistory('test-session', messages)).resolves.toBeUndefined();
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