import { describe, it, expect } from 'vitest';
import { findCredentialsForRepo } from './gitCredentials';
import type { GitCredential } from '@/contexts/GitSettingsContext';

// Helper to create test credentials with required fields
function createTestCredential(overrides: Partial<GitCredential> & { protocol?: string; host?: string } = {}): GitCredential {
  // Extract protocol and host if provided (for backward compatibility with tests)
  const { protocol = 'https', host = 'github.com', ...rest } = overrides;

  // Construct origin from protocol and host if origin is not provided
  const origin = rest.origin || `${protocol}://${host}`;

  return {
    id: crypto.randomUUID(),
    name: 'Test Credential',
    origin,
    username: 'user',
    password: 'pass',
    ...rest,
  };
}

describe('gitCredentials', () => {
  describe('findCredentialsForRepo', () => {
    it('returns undefined when no credentials are provided', () => {
      const result = findCredentialsForRepo('https://github.com/user/repo.git', []);
      expect(result).toBeUndefined();
    });

    it('returns undefined when no credentials match', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'gitlab.com',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('matches credential with exact protocol, hostname, and default port', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'github.com',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches credential with explicit port 443 for https', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'github.com:443',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches credential with explicit port 80 for http', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          protocol: 'http',
          host: 'example.com:80',
        }),
      ];
      const result = findCredentialsForRepo('http://example.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches credential with custom port when URL has same custom port', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'gitlab.local:8443',
        }),
      ];
      const result = findCredentialsForRepo('https://gitlab.local:8443/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('does not match when ports differ', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'gitlab.local:8443',
        }),
      ];
      const result = findCredentialsForRepo('https://gitlab.local:9443/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('does not match when protocol differs', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          protocol: 'http',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/user/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('does not match when hostname differs', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'github.com',
        }),
      ];
      const result = findCredentialsForRepo('https://gitlab.com/user/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('prefers credential with matching username over credential without username', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: '',
          password: 'pass1',
        }),
        createTestCredential({
          username: 'alice',
          password: 'pass2',
        }),
      ];
      const result = findCredentialsForRepo('https://alice@github.com/repo.git', credentials);
      expect(result).toBe(credentials[1]);
    });

    it('returns first match when no username preference exists', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: '',
          password: 'pass1',
        }),
        createTestCredential({
          username: '',
          password: 'pass2',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('does not match when usernames differ', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: 'alice',
        }),
      ];
      const result = findCredentialsForRepo('https://bob@github.com/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('matches when credential has username but URL does not', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: 'alice',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('matches when URL has username but credential does not', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: '',
        }),
      ];
      const result = findCredentialsForRepo('https://alice@github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('handles multiple matching credentials and returns the one with matching username', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: 'alice',
          password: 'pass1',
        }),
        createTestCredential({
          username: 'bob',
          password: 'pass2',
        }),
        createTestCredential({
          username: '',
          password: 'pass3',
        }),
      ];
      const result = findCredentialsForRepo('https://bob@github.com/repo.git', credentials);
      expect(result).toBe(credentials[1]);
    });

    it('handles complex URLs with paths and query parameters', () => {
      const credentials: GitCredential[] = [
        createTestCredential({}),
      ];
      const result = findCredentialsForRepo(
        'https://github.com/org/repo.git?foo=bar#fragment',
        credentials
      );
      expect(result).toBe(credentials[0]);
    });

    it('handles URLs with encoded characters', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: 'user%40email.com',
        }),
      ];
      const result = findCredentialsForRepo(
        'https://user%40email.com@github.com/repo.git',
        credentials
      );
      expect(result).toBe(credentials[0]);
    });

    it('handles subdomains correctly', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          host: 'api.github.com',
        }),
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
        createTestCredential({
          host: 'github.com',
          username: '',
          password: 'token',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('returns credential when both URL and credential have no username', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          username: '',
          password: 'token',
        }),
      ];
      const result = findCredentialsForRepo('https://github.com/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('handles IPv4 addresses as hostnames', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          protocol: 'http',
          host: '192.168.1.100:8080',
        }),
      ];
      const result = findCredentialsForRepo('http://192.168.1.100:8080/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });

    it('does not match IPv4 addresses with different ports', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          protocol: 'http',
          host: '192.168.1.100:8080',
        }),
      ];
      const result = findCredentialsForRepo('http://192.168.1.100:9090/repo.git', credentials);
      expect(result).toBeUndefined();
    });

    it('handles localhost URLs', () => {
      const credentials: GitCredential[] = [
        createTestCredential({
          protocol: 'http',
          host: 'localhost:3000',
          username: 'dev',
        }),
      ];
      const result = findCredentialsForRepo('http://localhost:3000/repo.git', credentials);
      expect(result).toBe(credentials[0]);
    });
  });
});
