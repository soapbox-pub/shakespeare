import { describe, it, expect } from 'vitest';
import { convertYarnLockToPackageLock } from './yarnLockConverter';

describe('convertYarnLockToPackageLock', () => {
  it('should convert a simple yarn.lock entry', () => {
    const yarnLock = `
# yarn lockfile v1

react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
  integrity sha512-...
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages['node_modules/react']).toEqual({
      name: 'react',
      version: '18.2.0',
    });
  });

  it('should convert scoped packages', () => {
    const yarnLock = `
"@babel/core@^7.0.0":
  version "7.23.0"
  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.23.0.tgz"
  integrity sha512-...
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages['node_modules/@babel/core']).toEqual({
      name: '@babel/core',
      version: '7.23.0',
    });
  });

  it('should parse dependencies', () => {
    const yarnLock = `
react-dom@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react-dom/-/react-dom-18.2.0.tgz"
  integrity sha512-...
  dependencies:
    loose-envify "^1.1.0"
    scheduler "^0.23.0"
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages['node_modules/react-dom']).toEqual({
      name: 'react-dom',
      version: '18.2.0',
      dependencies: {
        'loose-envify': '^1.1.0',
        'scheduler': '^0.23.0',
      },
    });
  });

  it('should parse peer dependencies', () => {
    const yarnLock = `
"@testing-library/react@^14.0.0":
  version "14.0.0"
  resolved "https://registry.yarnpkg.com/@testing-library/react/-/react-14.0.0.tgz"
  integrity sha512-...
  peerDependencies:
    react "^18.0.0"
    react-dom "^18.0.0"
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
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
    const yarnLock = `
react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"

react-dom@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react-dom/-/react-dom-18.2.0.tgz"
  dependencies:
    react "^18.0.0"
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages['node_modules/react']).toEqual({
      name: 'react',
      version: '18.2.0',
    });
    
    expect(result.packages['node_modules/react-dom']).toEqual({
      name: 'react-dom',
      version: '18.2.0',
      dependencies: {
        react: '^18.0.0',
      },
    });
  });

  it('should handle npm alias syntax', () => {
    const yarnLock = `
"package@npm:other-package@^1.0.0":
  version "1.2.3"
  resolved "https://registry.yarnpkg.com/other-package/-/other-package-1.2.3.tgz"
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages['node_modules/package']).toEqual({
      name: 'package',
      version: '1.2.3',
    });
  });

  it('should skip entries without version', () => {
    const yarnLock = `
invalid-entry@^1.0.0:
  resolved "https://registry.yarnpkg.com/invalid/-/invalid-1.0.0.tgz"

valid-entry@^1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/valid/-/valid-1.0.0.tgz"
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages['node_modules/invalid-entry']).toBeUndefined();
    expect(result.packages['node_modules/valid-entry']).toEqual({
      name: 'valid-entry',
      version: '1.0.0',
    });
  });

  it('should handle empty yarn.lock', () => {
    const yarnLock = `
# yarn lockfile v1
`;

    const result = convertYarnLockToPackageLock(yarnLock);
    
    expect(result.packages).toEqual({});
  });
});
