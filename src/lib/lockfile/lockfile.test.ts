import { describe, expect, it } from 'vitest';

import { parseLockfile, readLockfile } from '.';
import { findInstalled, layOut, type LockNode } from './tree';

/** The version Node would load for `name` when imported from `from`. */
function resolveVersion(packages: Record<string, { version?: string }>, from: string, name: string) {
  const path = findInstalled(from, name, (p) => p in packages);
  return path && packages[path].version;
}

describe('layOut', () => {
  it('hoists, and nests only on conflict', () => {
    const { packages } = layOut({
      root: { a: 'a@1', b: 'b@1', c: 'c@2' },
      nodes: new Map<string, LockNode>([
        ['a@1', { name: 'a', version: '1.0.0', dependencies: { c: 'c@1', d: 'd@1' } }],
        ['b@1', { name: 'b', version: '1.0.0', dependencies: { c: 'c@2', d: 'd@1' } }],
        ['c@1', { name: 'c', version: '1.0.0', dependencies: {} }],
        ['c@2', { name: 'c', version: '2.0.0', dependencies: {} }],
        ['d@1', { name: 'd', version: '1.0.0', dependencies: { a: 'a@1' } }],
      ]),
    });

    expect(Object.keys(packages).sort()).toEqual([
      'node_modules/a',
      'node_modules/a/node_modules/c',
      'node_modules/b',
      'node_modules/c',
      'node_modules/d',
    ]);
    expect(resolveVersion(packages, 'node_modules/a', 'c')).toBe('1.0.0');
    expect(resolveVersion(packages, 'node_modules/b', 'c')).toBe('2.0.0');
    expect(packages['node_modules/a'].dependencies).toEqual({ c: '1.0.0', d: '1.0.0' });
  });
});

describe('package-lock.json', () => {
  it('fills in names from paths, keeping alias names', () => {
    const { packages } = parseLockfile('package-lock.json', JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { name: 'app' },
        'node_modules/@scope/pkg': { version: '1.0.0' },
        'node_modules/@std/encoding': { name: '@jsr/std__encoding', version: '1.0.10' },
      },
    }));
    expect(packages['node_modules/@scope/pkg'].name).toBe('@scope/pkg');
    expect(packages['node_modules/@std/encoding'].name).toBe('@jsr/std__encoding');
    expect(packages[''].name).toBe('app');
  });

  it('converts lockfileVersion 1', () => {
    const { packages } = parseLockfile('package-lock.json', JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        a: {
          version: '1.0.0',
          resolved: 'https://registry.npmjs.org/a/-/a-1.0.0.tgz',
          requires: { b: '^1.0.0' },
          dependencies: { b: { version: '1.5.0' } },
        },
        b: { version: '2.0.0' },
        'b-old': { version: 'npm:b@0.1.0' },
      },
    }));
    expect(packages['node_modules/a'].resolved).toBe('https://registry.npmjs.org/a/-/a-1.0.0.tgz');
    expect(packages['node_modules/a/node_modules/b'].version).toBe('1.5.0');
    expect(packages['node_modules/b-old']).toMatchObject({ name: 'b', version: '0.1.0' });
  });
});

describe('pnpm-lock.yaml', () => {
  const v9 = `
lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      react-dom:
        specifier: ^19.0.0
        version: 19.0.0(react@19.0.0)
      '@std/encoding':
        specifier: npm:@jsr/std__encoding@^1.0.10
        version: '@jsr/std__encoding@1.0.11'
      local:
        specifier: link:../local
        version: link:../local
    devDependencies:
      react:
        specifier: ^19.0.0
        version: 19.0.0

packages:

  '@jsr/std__encoding@1.0.11':
    resolution: {integrity: sha512-jsr, tarball: https://npm.jsr.io/~/11/@jsr/std__encoding/1.0.11.tgz}

  react-dom@19.0.0:
    resolution: {integrity: sha512-dom}
    peerDependencies:
      react: ^19.0.0

  react@18.3.1:
    resolution: {integrity: sha512-old}

  react@19.0.0:
    resolution: {integrity: sha512-new}

  scheduler@0.25.0:
    resolution: {integrity: sha512-scheduler}

snapshots:

  '@jsr/std__encoding@1.0.11': {}

  react-dom@19.0.0(react@19.0.0):
    dependencies:
      react: 19.0.0
      scheduler: 0.25.0

  react@18.3.1: {}

  react@19.0.0: {}

  scheduler@0.25.0:
    dependencies:
      react: 18.3.1
`;

  it('lays out lockfileVersion 9 with tarball URLs and integrity', () => {
    const { packages } = parseLockfile('pnpm-lock.yaml', v9);
    expect(packages['node_modules/react-dom']).toEqual({
      name: 'react-dom',
      version: '19.0.0',
      resolved: 'https://registry.npmjs.org/react-dom/-/react-dom-19.0.0.tgz',
      integrity: 'sha512-dom',
      dependencies: { react: '19.0.0', scheduler: '0.25.0' },
      peerDependencies: { react: '^19.0.0' },
    });
    expect(packages['node_modules/scheduler/node_modules/react'].version).toBe('18.3.1');
    expect(packages['node_modules/@std/encoding']).toMatchObject({
      name: '@jsr/std__encoding',
      version: '1.0.11',
      resolved: 'https://npm.jsr.io/~/11/@jsr/std__encoding/1.0.11.tgz',
    });
    expect(packages['node_modules/local']).toBeUndefined();
  });

  it('reads lockfileVersion 6', () => {
    const { packages } = parseLockfile('pnpm-lock.yaml', `
lockfileVersion: '6.0'

dependencies:
  a:
    specifier: ^1.0.0
    version: 1.0.0(react@19.0.0)
  b-alias:
    specifier: npm:b@^2.0.0
    version: /b@2.0.0

packages:

  /a@1.0.0(react@19.0.0):
    resolution: {integrity: sha512-a}
    dependencies:
      '@scope/c': 3.0.0

  /b@2.0.0:
    resolution: {integrity: sha512-b}

  /@scope/c@3.0.0:
    resolution: {integrity: sha512-c}
`);
    expect(packages['node_modules/a']).toMatchObject({ version: '1.0.0', integrity: 'sha512-a' });
    expect(packages['node_modules/b-alias']).toMatchObject({ name: 'b', version: '2.0.0' });
    expect(packages['node_modules/@scope/c'].resolved).toBe('https://registry.npmjs.org/@scope/c/-/c-3.0.0.tgz');
  });

  it('rejects versions it does not understand', () => {
    expect(() => parseLockfile('pnpm-lock.yaml', "lockfileVersion: '5.4'\n")).toThrow(/unsupported/);
  });
});

describe('bun.lock', () => {
  it('maps keys to node_modules paths', () => {
    const { packages } = parseLockfile('bun.lock', `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "app", "dependencies": { "@babel/core": "^7.0.0" } } },
  "packages": {
    "@babel/core": ["@babel/core@7.29.0", "", { "dependencies": { "semver": "^6.3.1" } }, "sha512-core"],
    "@babel/core/semver": ["semver@6.3.1", "", {}, "sha512-six"],
    "semver": ["semver@7.7.0", "", {}, "sha512-seven"],
    "@std/encoding": ["@jsr/std__encoding@1.0.11", "https://npm.jsr.io/~/11/@jsr/std__encoding/1.0.11.tgz", {}, "sha512-jsr"],
    "private": ["private@1.0.0", "https://npm.example.com/", {}, "sha512-p"],
    "local": ["local@workspace:packages/local", { "dependencies": {} }],
  },
}`);
    expect(packages['node_modules/@babel/core']).toMatchObject({
      version: '7.29.0',
      resolved: 'https://registry.npmjs.org/@babel/core/-/core-7.29.0.tgz',
      integrity: 'sha512-core',
    });
    expect(resolveVersion(packages, 'node_modules/@babel/core', 'semver')).toBe('6.3.1');
    expect(resolveVersion(packages, '', 'semver')).toBe('7.7.0');
    expect(packages['node_modules/@std/encoding']).toMatchObject({
      name: '@jsr/std__encoding',
      resolved: 'https://npm.jsr.io/~/11/@jsr/std__encoding/1.0.11.tgz',
    });
    expect(packages['node_modules/private'].resolved).toBe('https://npm.example.com/private/-/private-1.0.0.tgz');
    expect(packages['node_modules/local'].link).toBe(true);
  });
});

describe('yarn.lock', () => {
  it('reads Yarn 1, nesting conflicting versions', () => {
    const { packages } = parseLockfile('yarn.lock', `# yarn lockfile v1


"@scope/a@^1.0.0":
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/@scope/a/-/a-1.0.0.tgz#abc"
  integrity sha512-a
  dependencies:
    zod "^3.0.0"

"zod@^3.0.0 || ^4.0.0", zod@^4.0.0:
  version "4.1.0"
  resolved "https://registry.yarnpkg.com/zod/-/zod-4.1.0.tgz#def"

zod@^3.0.0:
  version "3.25.0"
  resolved "https://registry.yarnpkg.com/zod/-/zod-3.25.0.tgz#ghi"

"wrap-cjs@npm:wrap@^7.0.0":
  version "7.0.0"
  resolved "https://registry.yarnpkg.com/wrap/-/wrap-7.0.0.tgz#jkl"
`, { dependencies: { '@scope/a': '^1.0.0', zod: '^4.0.0', 'wrap-cjs': 'npm:wrap@^7.0.0' } });

    expect(packages['node_modules/@scope/a']).toMatchObject({
      version: '1.0.0',
      resolved: 'https://registry.npmjs.org/@scope/a/-/a-1.0.0.tgz',
      integrity: 'sha512-a',
    });
    expect(packages['node_modules/zod'].version).toBe('4.1.0');
    expect(resolveVersion(packages, 'node_modules/@scope/a', 'zod')).toBe('3.25.0');
    expect(packages['node_modules/wrap-cjs']).toMatchObject({ name: 'wrap', version: '7.0.0' });
  });

  it('reads Yarn Berry, including builtin patches', () => {
    const { packages } = parseLockfile('yarn.lock', `__metadata:
  version: 8
  cacheKey: 10c0

"app@workspace:.":
  version: 0.0.0-use.local
  resolution: "app@workspace:."
  dependencies:
    react: "npm:^19.0.0"
    typescript: "patch:typescript@npm%3A^5.0.0#optional!builtin<compat/typescript>"
  languageName: unknown
  linkType: soft

"react@npm:^19.0.0":
  version: 19.0.0
  resolution: "react@npm:19.0.0"
  checksum: 10c0/abc
  languageName: node
  linkType: hard

"typescript@npm:^5.0.0":
  version: 5.9.3
  resolution: "typescript@npm:5.9.3"
  languageName: node
  linkType: hard

"typescript@patch:typescript@npm%3A^5.0.0#optional!builtin<compat/typescript>":
  version: 5.9.3
  resolution: "typescript@patch:typescript@npm%3A5.9.3#optional!builtin<compat/typescript>::version=5.9.3&hash=5786d5"
  languageName: node
  linkType: hard
`);
    expect(packages['node_modules/react']).toEqual({
      name: 'react',
      version: '19.0.0',
      resolved: 'https://registry.npmjs.org/react/-/react-19.0.0.tgz',
    });
    expect(packages['node_modules/typescript'].version).toBe('5.9.3');
  });
});

describe('readLockfile', () => {
  it('prefers package-lock.json, and skips lockfiles it cannot parse', async () => {
    const files: Record<string, string> = {
      'pnpm-lock.yaml': "lockfileVersion: '5.4'\n",
      'bun.lock': '{ "packages": { "a": ["a@1.0.0", "", {}, "sha512-a"] } }',
    };
    const found = await readLockfile((file) => files[file]);
    expect(found?.file).toBe('bun.lock');

    files['package-lock.json'] = '{ "packages": {} }';
    expect((await readLockfile((file) => files[file]))?.file).toBe('package-lock.json');
  });
});
