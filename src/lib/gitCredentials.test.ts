import { describe, it, expect } from 'vitest';
import { extractGitOrigin, findCredentialsForRepo, getOriginDisplayName } from './gitCredentials';
import type { GitCredential } from '@/contexts/GitSettingsContext';

describe('gitCredentials', () => {
  describe('extractGitOrigin', () => {
    it('should extract origin from HTTPS URLs', () => {
      expect(extractGitOrigin('https://github.com/user/repo.git')).toBe('https://github.com');
      expect(extractGitOrigin('https://gitlab.com/user/repo.git')).toBe('https://gitlab.com');
      expect(extractGitOrigin('https://git.example.com:8080/user/repo.git')).toBe('https://git.example.com:8080');
    });

    it('should extract origin from HTTP URLs', () => {
      expect(extractGitOrigin('http://git.example.com/user/repo.git')).toBe('http://git.example.com');
    });

    it('should extract origin from SSH URLs', () => {
      expect(extractGitOrigin('git@github.com:user/repo.git')).toBe('https://github.com');
      expect(extractGitOrigin('git@gitlab.com:user/repo.git')).toBe('https://gitlab.com');
      expect(extractGitOrigin('git@git.example.com:user/repo.git')).toBe('https://git.example.com');
    });

    it('should return null for invalid URLs', () => {
      expect(extractGitOrigin('')).toBe(null);
      expect(extractGitOrigin('invalid-url')).toBe(null);
      expect(extractGitOrigin('ftp://example.com/repo')).toBe(null);
    });
  });

  describe('findCredentialsForRepo', () => {
    const mockCredentials: Record<string, GitCredential> = {
      'https://github.com': { username: 'git', password: 'github-token' },
      'https://gitlab.com': { username: 'git', password: 'gitlab-token' },
      'https://git.example.com': { username: 'user', password: 'custom-token' },
    };

    it('should find exact matches', () => {
      expect(findCredentialsForRepo('https://github.com/user/repo.git', mockCredentials))
        .toEqual({ username: 'git', password: 'github-token' });
      
      expect(findCredentialsForRepo('https://gitlab.com/user/repo.git', mockCredentials))
        .toEqual({ username: 'git', password: 'gitlab-token' });
    });

    it('should find matches for SSH URLs', () => {
      expect(findCredentialsForRepo('git@github.com:user/repo.git', mockCredentials))
        .toEqual({ username: 'git', password: 'github-token' });
    });

    it('should handle case-insensitive matching', () => {
      expect(findCredentialsForRepo('https://GitHub.com/user/repo.git', mockCredentials))
        .toEqual({ username: 'git', password: 'github-token' });
    });

    it('should handle www variations', () => {
      const credentialsWithWww = {
        'https://www.github.com': { username: 'git', password: 'github-token' },
      };
      
      expect(findCredentialsForRepo('https://github.com/user/repo.git', credentialsWithWww))
        .toEqual({ username: 'git', password: 'github-token' });
      
      expect(findCredentialsForRepo('https://www.github.com/user/repo.git', mockCredentials))
        .toEqual({ username: 'git', password: 'github-token' });
    });

    it('should return undefined when no credentials found', () => {
      expect(findCredentialsForRepo('https://unknown.com/user/repo.git', mockCredentials))
        .toBe(undefined);

      expect(findCredentialsForRepo('invalid-url', mockCredentials))
        .toBe(undefined);
    });

    it('should return undefined for empty credentials', () => {
      expect(findCredentialsForRepo('https://github.com/user/repo.git', {}))
        .toBe(undefined);
    });
  });

  describe('getOriginDisplayName', () => {
    it('should extract hostname from valid URLs', () => {
      expect(getOriginDisplayName('https://github.com')).toBe('github.com');
      expect(getOriginDisplayName('https://git.example.com:8080')).toBe('git.example.com:8080');
    });

    it('should return original string for invalid URLs', () => {
      expect(getOriginDisplayName('invalid-url')).toBe('invalid-url');
      expect(getOriginDisplayName('')).toBe('');
    });
  });
});