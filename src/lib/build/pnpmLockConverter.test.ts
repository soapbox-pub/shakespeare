import { describe, it, expect } from 'vitest';
import { convertPnpmLockToPackageLock } from './pnpmLockConverter';

describe('convertPnpmLockToPackageLock', () => {
  it('should convert a simple pnpm-lock.yaml entry', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /react@18.2.0:
    version: 18.2.0
    resolution: {integrity: sha512-...}
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/react']).toEqual({
      name: 'react',
      version: '18.2.0',
    });
  });

  it('should convert scoped packages', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /@babel/core@7.23.0:
    version: 7.23.0
    resolution: {integrity: sha512-...}
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/@babel/core']).toEqual({
      name: '@babel/core',
      version: '7.23.0',
    });
  });

  it('should parse dependencies', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /react-dom@18.2.0(react@18.2.0):
    version: 18.2.0
    resolution: {integrity: sha512-...}
    dependencies:
      loose-envify: 1.4.0
      scheduler: 0.23.0
    peerDependencies:
      react: ^18.2.0
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/react-dom']).toEqual({
      name: 'react-dom',
      version: '18.2.0',
      dependencies: {
        'loose-envify': '1.4.0',
        'scheduler': '0.23.0',
      },
      peerDependencies: {
        'react': '^18.2.0',
      },
    });
  });

  it('should parse peer dependencies', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /@testing-library/react@14.0.0(react-dom@18.2.0)(react@18.2.0):
    version: 14.0.0
    resolution: {integrity: sha512-...}
    peerDependencies:
      react: ^18.0.0
      react-dom: ^18.0.0
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/@testing-library/react']).toEqual({
      name: '@testing-library/react',
      version: '14.0.0',
      peerDependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
    });
  });

  it('should handle multiple packages', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /react@18.2.0:
    version: 18.2.0
    resolution: {integrity: sha512-...}

  /react-dom@18.2.0(react@18.2.0):
    version: 18.2.0
    resolution: {integrity: sha512-...}
    dependencies:
      react: 18.2.0
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/react']).toEqual({
      name: 'react',
      version: '18.2.0',
    });

    expect(result.packages['node_modules/react-dom']).toEqual({
      name: 'react-dom',
      version: '18.2.0',
      dependencies: {
        react: '18.2.0',
      },
    });
  });

  it('should skip entries without version', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /invalid-entry@1.0.0:
    resolution: {integrity: sha512-...}

  /valid-entry@1.0.0:
    version: 1.0.0
    resolution: {integrity: sha512-...}
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/invalid-entry']).toBeUndefined();
    expect(result.packages['node_modules/valid-entry']).toEqual({
      name: 'valid-entry',
      version: '1.0.0',
    });
  });

  it('should handle empty pnpm-lock.yaml', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages).toEqual({});
  });

  it('should handle packages with peer dependency specifiers in key', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /styled-components@6.0.0(react-dom@18.2.0)(react@18.2.0):
    version: 6.0.0
    resolution: {integrity: sha512-...}
    dependencies:
      some-dep: 1.0.0
    peerDependencies:
      react: '>= 16.8.0'
      react-dom: '>= 16.8.0'
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    expect(result.packages['node_modules/styled-components']).toEqual({
      name: 'styled-components',
      version: '6.0.0',
      dependencies: {
        'some-dep': '1.0.0',
      },
      peerDependencies: {
        react: '>= 16.8.0',
        'react-dom': '>= 16.8.0',
      },
    });
  });

  it('should stop parsing after packages section ends', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /react@18.2.0:
    version: 18.2.0
    resolution: {integrity: sha512-...}

snapshots:
  /react@18.2.0:
    dependencies:
      loose-envify: 1.4.0
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    // Should only have the package from packages section, not from snapshots
    expect(result.packages['node_modules/react']).toEqual({
      name: 'react',
      version: '18.2.0',
    });
    expect(Object.keys(result.packages).length).toBe(1);
  });

  it('should handle multiple installations of same package@version with different peer deps', () => {
    const pnpmLock = `
lockfileVersion: '9.0'

packages:

  /eslint-plugin-svelte@3.9.3(eslint@9.34.0)(svelte@5.39.8):
    version: 3.9.3
    resolution: {integrity: sha512-...}
    peerDependencies:
      eslint: ^8.0.0 || ^9.0.0
      svelte: ^4.0.0 || ^5.0.0

  /eslint-plugin-svelte@3.9.3(eslint@8.57.1)(svelte@5.39.8):
    version: 3.9.3
    resolution: {integrity: sha512-...}
    peerDependencies:
      eslint: ^8.0.0 || ^9.0.0
      svelte: ^4.0.0 || ^5.0.0
`;

    const result = convertPnpmLockToPackageLock(pnpmLock);

    // First installation should use simple path
    expect(result.packages['node_modules/eslint-plugin-svelte']).toEqual({
      name: 'eslint-plugin-svelte',
      version: '3.9.3',
      peerDependencies: {
        eslint: '^8.0.0 || ^9.0.0',
        svelte: '^4.0.0 || ^5.0.0',
      },
    });

    // Second installation should use nested path
    expect(result.packages['node_modules/.pnpm/eslint-plugin-svelte_1']).toEqual({
      name: 'eslint-plugin-svelte',
      version: '3.9.3',
      peerDependencies: {
        eslint: '^8.0.0 || ^9.0.0',
        svelte: '^4.0.0 || ^5.0.0',
      },
    });

    expect(Object.keys(result.packages).length).toBe(2);
  });
});
