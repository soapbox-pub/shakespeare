import { describe, it, expect } from 'vitest';
import { findCredentialsForRepo } from './gitCredentials';
import type { GitCredential } from '@/contexts/GitSettingsContext';

describe('gitCredentials', () => {
  describe('findCredentialsForRepo', () => {
    it('returns undefined when no credentials are provided', () => {
      const result = findCredentialsForRepo('https://github.com/user/repo.git', []);
      expect(result).toBeUndefined();
    });

    it('returns undefined when no credentials match', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'gitlab.com',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('matches credential with exact protocol, hostname, and default port', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches credential with explicit port 443 for https', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com:443',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches credential with explicit port 80 for http', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'http',
          host: 'example.com:80',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('http://example.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches credential with custom port when URL has same custom port', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'gitlab.local:8443',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://gitlab.local:8443/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('does not match when ports differ', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'gitlab.local:8443',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://gitlab.local:9443/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('does not match when protocol differs', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'http',
          host: 'github.com',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('does not match when hostname differs', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://gitlab.com/user/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('prefers credential with matching username over credential without username', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'pass1',
        },
        {
          protocol: 'https',
          host: 'github.com',
          username: 'alice',
          password: 'pass2',
        },
      ];
      const result = findCredentialsForRepo('https://alice@github.com/repo.git', credentials);
      expect(result).toBe(credentials[1]);
    });

    it('returns first match when no username preference exists', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'pass1',
        },
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'pass2',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('does not match when usernames differ', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'alice',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://bob@github.com/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('matches when credential has username but URL does not', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'alice',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches when URL has username but credential does not', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('https://alice@github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('handles multiple matching credentials and returns the one with matching username', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'alice',
          password: 'pass1',
        },
        {
          protocol: 'https',
          host: 'github.com',
          username: 'bob',
          password: 'pass2',
        },
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'pass3',
        },
      ];
      const result = findCredentialsForRepo('https://bob@github.com/repo.git', credentials);
      expect(result).toBe(credentials[1]);
    });

    it('handles complex URLs with paths and query parameters', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo(
        'https://github.com/org/repo.git?foo=bar#fragment',
        credentials
      );
      expect(result).toBe(credentials[0]);
    });

    it('handles URLs with encoded characters', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: 'user%40email.com',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo(
        'https://user%40email.com@github.com/repo.git',
        credentials
      );
      expect(result).toBe(credentials[0]);
    });

    it('handles subdomains correctly', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'api.github.com',
          username: 'user',
          password: 'pass',
        },
      ];
      // Should not match github.com
      const result1 = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result1).toBeUndefined();

      // Should match api.github.com
      const result2 = findCredentialsForRepo('https://api.github.com/repo.git', credentials);
      expect(result2).toBe(credentials[0]);
    });

    it('handles credentials with empty username', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'token',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('returns credential when both URL and credential have no username', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'https',
          host: 'github.com',
          username: '',
          password: 'token',
        },
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('handles IPv4 addresses as hostnames', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'http',
          host: '192.168.1.100:8080',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('http://192.168.1.100:8080/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('does not match IPv4 addresses with different ports', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'http',
          host: '192.168.1.100:8080',
          username: 'user',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('http://192.168.1.100:9090/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('handles localhost URLs', () => {
      const credentials: GitCredential[] = [
        {
          protocol: 'http',
          host: 'localhost:3000',
          username: 'dev',
          password: 'pass',
        },
      ];
      const result = findCredentialsForRepo('http://localhost:3000/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });
  });
});
