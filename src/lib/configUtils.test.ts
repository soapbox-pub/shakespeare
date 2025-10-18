import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readAISettings,
  writeAISettings,
  readGitSettings,
  writeGitSettings,
  readDeploySettings,
  writeDeploySettings
} from './configUtils';
import type { JSRuntimeFS } from './JSRuntime';
import type { AISettings } from '@/contexts/AISettingsContext';
import type { GitSettings } from '@/contexts/GitSettingsContext';
import type { DeploySettings } from '@/contexts/DeploySettingsContext';

// Mock filesystem
const createMockFS = (): JSRuntimeFS => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
  rmdir: vi.fn(),
  unlink: vi.fn(),
  lstat: vi.fn(),
  rename: vi.fn(),
  readlink: vi.fn(),
  symlink: vi.fn(),
});

// Mock localStorage
const createMockLocalStorage = () => {
  const storage: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
    clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
    length: 0,
    key: vi.fn(),
  };
};

describe('configUtils', () => {
  let mockFS: JSRuntimeFS;
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    mockFS = createMockFS();
    mockLocalStorage = createMockLocalStorage();

    // Replace global localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  describe('AI Settings', () => {
    const sampleAISettings: AISettings = {
      providers: [
        {
          id: 'openai',
          baseURL: 'https://api.openai.com/v1',
          apiKey: 'sk-test123',
        },
      ],
      recentlyUsedModels: ['openai/gpt-4', 'openai/gpt-3.5-turbo'],
    };

    describe('readAISettings', () => {
      it('should read AI settings from VFS', async () => {
        vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(sampleAISettings));

        const result = await readAISettings(mockFS);

        expect(mockFS.readFile).toHaveBeenCalledWith('/config/ai.json', 'utf8');
        expect(result).toEqual(sampleAISettings);
      });

      it('should return default settings if file does not exist and no localStorage data', async () => {
        vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));
        mockLocalStorage.getItem.mockReturnValue(null);

        const result = await readAISettings(mockFS);

        expect(result).toEqual({
          providers: [],
          recentlyUsedModels: [],
        });
      });

      it('should return default settings if JSON is invalid and no localStorage data', async () => {
        vi.mocked(mockFS.readFile).mockResolvedValue('invalid json');
        mockLocalStorage.getItem.mockReturnValue(null);

        const result = await readAISettings(mockFS);

        expect(result).toEqual({
          providers: [],
          recentlyUsedModels: [],
        });
      });
    });

    describe('writeAISettings', () => {
      it('should write AI settings to VFS', async () => {
        vi.mocked(mockFS.stat).mockRejectedValue(new Error('Directory not found'));
        vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);
        vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

        await writeAISettings(mockFS, sampleAISettings);

        expect(mockFS.mkdir).toHaveBeenCalledWith('/config', { recursive: true });
        expect(mockFS.writeFile).toHaveBeenCalledWith(
          '/config/ai.json',
          JSON.stringify(sampleAISettings, null, 2),
          'utf8'
        );
      });

      it('should not create directory if it already exists', async () => {
        vi.mocked(mockFS.stat).mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
        });
        vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

        await writeAISettings(mockFS, sampleAISettings);

        expect(mockFS.mkdir).not.toHaveBeenCalled();
        expect(mockFS.writeFile).toHaveBeenCalledWith(
          '/config/ai.json',
          JSON.stringify(sampleAISettings, null, 2),
          'utf8'
        );
      });
    });


  });

  describe('Git Settings', () => {
    const sampleGitSettings: GitSettings = {
      credentials: {
        'github.com': {
          username: 'user',
          password: 'token123',
        },
      },
      hostTokens: {},
    };

    describe('readGitSettings', () => {
      it('should read Git settings from VFS', async () => {
        vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(sampleGitSettings));

        const result = await readGitSettings(mockFS);

        expect(mockFS.readFile).toHaveBeenCalledWith('/config/git.json', 'utf8');
        expect(result).toEqual(sampleGitSettings);
      });

      it('should return default settings if file does not exist and no localStorage data', async () => {
        vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));
        mockLocalStorage.getItem.mockReturnValue(null);

        const result = await readGitSettings(mockFS);

        expect(result).toEqual({
          credentials: {},
          hostTokens: {},
          coAuthorEnabled: true,
        });
      });
    });

    describe('writeGitSettings', () => {
      it('should write Git settings to VFS', async () => {
        vi.mocked(mockFS.stat).mockRejectedValue(new Error('Directory not found'));
        vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);
        vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

        await writeGitSettings(mockFS, sampleGitSettings);

        expect(mockFS.mkdir).toHaveBeenCalledWith('/config', { recursive: true });
        expect(mockFS.writeFile).toHaveBeenCalledWith(
          '/config/git.json',
          JSON.stringify(sampleGitSettings, null, 2),
          'utf8'
        );
      });
    });


  });

  describe('Deploy Settings', () => {
    const sampleDeploySettings: DeploySettings = {
      providers: [
        {
          name: 'My Netlify',
          type: 'netlify',
          apiKey: 'netlify-token-123',
        },
        {
          name: 'My Vercel',
          type: 'vercel',
          apiKey: 'vercel-token-456',
        },
        {
          name: 'Shakespeare',
          type: 'shakespeare',
        },
      ],
      defaultProviderId: 'netlify',
    };

    describe('readDeploySettings', () => {
      it('should read Deploy settings from VFS', async () => {
        vi.mocked(mockFS.readFile).mockResolvedValue(JSON.stringify(sampleDeploySettings));

        const result = await readDeploySettings(mockFS);

        expect(mockFS.readFile).toHaveBeenCalledWith('/config/deploy.json', 'utf8');
        expect(result).toEqual(sampleDeploySettings);
      });

      it('should return default settings if file does not exist', async () => {
        vi.mocked(mockFS.readFile).mockRejectedValue(new Error('File not found'));

        const result = await readDeploySettings(mockFS);

        expect(result).toEqual({
          providers: [],
        });
      });

      it('should return default settings if JSON is invalid', async () => {
        vi.mocked(mockFS.readFile).mockResolvedValue('invalid json');

        const result = await readDeploySettings(mockFS);

        expect(result).toEqual({
          providers: [],
        });
      });
    });

    describe('writeDeploySettings', () => {
      it('should write Deploy settings to VFS', async () => {
        vi.mocked(mockFS.stat).mockRejectedValue(new Error('Directory not found'));
        vi.mocked(mockFS.mkdir).mockResolvedValue(undefined);
        vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

        await writeDeploySettings(mockFS, sampleDeploySettings);

        expect(mockFS.mkdir).toHaveBeenCalledWith('/config', { recursive: true });
        expect(mockFS.writeFile).toHaveBeenCalledWith(
          '/config/deploy.json',
          JSON.stringify(sampleDeploySettings, null, 2),
          'utf8'
        );
      });

      it('should not create directory if it already exists', async () => {
        vi.mocked(mockFS.stat).mockResolvedValue({
          isDirectory: () => true,
          isFile: () => false,
        });
        vi.mocked(mockFS.writeFile).mockResolvedValue(undefined);

        await writeDeploySettings(mockFS, sampleDeploySettings);

        expect(mockFS.mkdir).not.toHaveBeenCalled();
        expect(mockFS.writeFile).toHaveBeenCalledWith(
          '/config/deploy.json',
          JSON.stringify(sampleDeploySettings, null, 2),
          'utf8'
        );
      });
    });
  });
});