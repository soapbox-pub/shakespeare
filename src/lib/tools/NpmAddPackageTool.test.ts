import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NpmAddPackageTool } from './NpmAddPackageTool';
import type { JSRuntimeFS } from '../JSRuntime';

/** An in-memory project directory. */
function memoryFS(files: Record<string, string>): JSRuntimeFS {
  return {
    readFile: vi.fn(async (path: string) => {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    }),
    writeFile: vi.fn(async (path: string, data: string) => {
      files[path] = data;
    }),
  } as unknown as JSRuntimeFS;
}

type Versions = Record<string, { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }>;

/** Serve abbreviated packuments for the given packages. */
function mockRegistry(packages: Record<string, { latest: string; versions: Versions }>) {
  return vi.fn(async (url: string) => {
    const name = decodeURIComponent(url.replace(/^https:\/\/[^/]+\//, ''));
    const pkg = packages[name];
    if (!pkg) return { ok: false, status: 404, statusText: 'Not Found' };
    const versions = Object.fromEntries(Object.entries(pkg.versions).map(([version, manifest]) => [version, {
      name,
      version,
      ...manifest,
      dist: {
        tarball: `https://registry.npmjs.org/${name}/-/${name.replace(/^@[^/]+\//, '')}-${version}.tgz`,
        integrity: `sha512-${name}-${version}`,
      },
    }]));
    return { ok: true, status: 200, json: async () => ({ name, 'dist-tags': { latest: pkg.latest }, versions }) };
  });
}

const registry = {
  lodash: { latest: '4.17.21', versions: { '4.17.20': {}, '4.17.21': {} } },
  typescript: { latest: '5.0.0', versions: { '5.0.0': {} } },
  'framer-motion': {
    latest: '12.0.0',
    versions: { '12.0.0': { dependencies: { 'motion-dom': '^12.0.0', tslib: '^2.4.0' }, peerDependencies: { react: '^18 || ^19' } } },
  },
  'motion-dom': { latest: '12.1.0', versions: { '12.1.0': { dependencies: { tslib: '^2.0.0' } } } },
  tslib: { latest: '2.8.1', versions: { '1.14.1': {}, '2.8.1': {} } },
  react: { latest: '19.0.0', versions: { '18.3.1': {}, '19.0.0': {} } },
};

const PROJECT = '/test/project';

function packageLock(packages: Record<string, unknown>) {
  return JSON.stringify({ name: 'test-project', version: '1.0.0', lockfileVersion: 3, requires: true, packages }, null, 2);
}

describe('NpmAddPackageTool', () => {
  let files: Record<string, string>;
  let fetchMock: ReturnType<typeof mockRegistry>;

  beforeEach(() => {
    files = {};
    fetchMock = mockRegistry(registry);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function tool() {
    return new NpmAddPackageTool(memoryFS(files), PROJECT);
  }

  function writePackageJson(json: Record<string, unknown>) {
    files[`${PROJECT}/package.json`] = JSON.stringify({ name: 'test-project', version: '1.0.0', ...json }, null, 2);
  }

  function readJson(file: string) {
    return JSON.parse(files[`${PROJECT}/${file}`]);
  }

  it('should successfully add a new package', async () => {
    writePackageJson({ dependencies: {} });

    const result = await tool().execute({ name: 'lodash' });

    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/lodash', expect.anything());
    expect(readJson('package.json').dependencies).toEqual({ lodash: '^4.17.21' });
    expect(result.content).toContain('✅ Successfully added lodash@4.17.21');
    expect(result.content).toContain('Updated: package.json');
  });

  it('should add package with specific version', async () => {
    writePackageJson({ dependencies: {} });

    const result = await tool().execute({ name: 'lodash', version: '4.17.20' });

    expect(readJson('package.json').dependencies.lodash).toBe('^4.17.20');
    expect(result.content).toContain('✅ Successfully added lodash@4.17.20');
  });

  it('should resolve a range to the version it picks', async () => {
    writePackageJson({});

    await tool().execute({ name: 'lodash', version: '~4.17.0' });

    expect(readJson('package.json').dependencies.lodash).toBe('^4.17.21');
  });

  it('should add dev dependency', async () => {
    writePackageJson({ dependencies: { lodash: '^4.17.21' } });

    const result = await tool().execute({ name: 'typescript', dev: true });

    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies.typescript).toBe('^5.0.0');
    expect(packageJson.dependencies.typescript).toBeUndefined();
    expect(result.content).toContain('Development dependency');
  });

  it('should move package from dependencies to devDependencies', async () => {
    writePackageJson({ dependencies: { typescript: '^5.0.0' } });

    const result = await tool().execute({ name: 'typescript', dev: true });

    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies.typescript).toBe('^5.0.0');
    expect(packageJson.dependencies).toBeUndefined();
    expect(result.content).toContain('✅ Successfully added');
  });

  it('should handle package already installed', async () => {
    writePackageJson({ dependencies: { lodash: '^4.17.21' } });
    const fs = memoryFS(files);

    const result = await new NpmAddPackageTool(fs, PROJECT).execute({ name: 'lodash' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(result.content).toContain('ℹ️ Package lodash is already installed in dependencies with version ^4.17.21.');
  });

  it('should handle package already installed with specific version', async () => {
    writePackageJson({ dependencies: { lodash: '^4.17.21' } });
    const fs = memoryFS(files);

    const result = await new NpmAddPackageTool(fs, PROJECT).execute({ name: 'lodash', version: '4.17.21' });

    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(result.content).toContain('ℹ️ Package lodash@4.17.21 is already installed in dependencies.');
  });

  it('should handle missing package.json', async () => {
    await expect(tool().execute({ name: 'lodash' })).rejects.toThrow('❌ Could not read package.json');
  });

  it('should handle invalid package.json', async () => {
    files[`${PROJECT}/package.json`] = 'invalid json';
    await expect(tool().execute({ name: 'lodash' })).rejects.toThrow('❌ Invalid package.json format');
  });

  it('should handle npm registry errors', async () => {
    writePackageJson({});
    await expect(tool().execute({ name: 'nonexistent-package' })).rejects.toThrow('❌ Could not fetch latest version');
  });

  it('should sort dependencies alphabetically', async () => {
    writePackageJson({ dependencies: { zlib: '^1.0.0', axios: '^1.0.0' } });

    await tool().execute({ name: 'lodash' });

    expect(Object.keys(readJson('package.json').dependencies)).toEqual(['axios', 'lodash', 'zlib']);
  });

  it('should install the package and its dependencies into package-lock.json', async () => {
    writePackageJson({ dependencies: { react: '^18.3.1' } });
    files[`${PROJECT}/package-lock.json`] = packageLock({
      '': { name: 'test-project', version: '1.0.0', dependencies: { react: '^18.3.1' } },
      'node_modules/react': { version: '18.3.1', license: 'MIT', dependencies: { tslib: '^1.0.0' } },
      'node_modules/tslib': { version: '1.14.1' },
    });

    const result = await tool().execute({ name: 'framer-motion' });

    const lock = readJson('package-lock.json');
    expect(lock.packages[''].dependencies).toEqual({ 'framer-motion': '^12.0.0', react: '^18.3.1' });
    expect(lock.packages['node_modules/framer-motion']).toEqual({
      version: '12.0.0',
      resolved: 'https://registry.npmjs.org/framer-motion/-/framer-motion-12.0.0.tgz',
      integrity: 'sha512-framer-motion-12.0.0',
      dependencies: { 'motion-dom': '^12.0.0', tslib: '^2.4.0' },
      peerDependencies: { react: '^18 || ^19' },
    });
    expect(lock.packages['node_modules/motion-dom'].version).toBe('12.1.0');
    // tslib@1 stays where it was; framer-motion and motion-dom each get 2.x nested.
    expect(lock.packages['node_modules/tslib'].version).toBe('1.14.1');
    expect(lock.packages['node_modules/framer-motion/node_modules/tslib'].version).toBe('2.8.1');
    expect(lock.packages['node_modules/motion-dom/node_modules/tslib'].version).toBe('2.8.1');
    // Existing entries are untouched.
    expect(lock.packages['node_modules/react']).toEqual({ version: '18.3.1', license: 'MIT', dependencies: { tslib: '^1.0.0' } });
    expect(result.content).toContain('Updated: package.json, package-lock.json');
  });

  it('should mark dev dependencies in package-lock.json', async () => {
    writePackageJson({});
    files[`${PROJECT}/package-lock.json`] = packageLock({ '': { name: 'test-project', version: '1.0.0' } });

    await tool().execute({ name: 'typescript', dev: true });

    const lock = readJson('package-lock.json');
    expect(lock.packages[''].devDependencies).toEqual({ typescript: '^5.0.0' });
    expect(lock.packages['node_modules/typescript'].dev).toBe(true);
  });

  it('should clear the dev flag when a package moves to dependencies', async () => {
    writePackageJson({ devDependencies: { typescript: '^5.0.0' } });
    files[`${PROJECT}/package-lock.json`] = packageLock({
      '': { name: 'test-project', version: '1.0.0', devDependencies: { typescript: '^5.0.0' } },
      'node_modules/typescript': { version: '5.0.0', resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.0.0.tgz', dev: true },
    });

    await tool().execute({ name: 'typescript' });

    const lock = readJson('package-lock.json');
    expect(lock.packages[''].dependencies).toEqual({ typescript: '^5.0.0' });
    expect(lock.packages[''].devDependencies).toBeUndefined();
    expect(lock.packages['node_modules/typescript'].dev).toBeUndefined();
  });

  it('should report peer dependency conflicts', async () => {
    writePackageJson({ dependencies: { react: '^17.0.0' } });
    files[`${PROJECT}/package-lock.json`] = packageLock({
      '': { name: 'test-project', version: '1.0.0', dependencies: { react: '^17.0.0' } },
      'node_modules/react': { version: '17.0.2' },
    });

    const result = await tool().execute({ name: 'framer-motion' });

    expect(result.content).toContain('framer-motion@12.0.0 wants react@^18 || ^19 as a peer, but 17.0.2 is installed');
  });

  it('should update bun.lock', async () => {
    writePackageJson({ dependencies: { react: '^19.0.0' } });
    files[`${PROJECT}/bun.lock`] = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "test-project",
      "dependencies": {
        "react": "^19.0.0",
      },
    },
  },
  "packages": {
    "react": ["react@19.0.0", "", {}, "sha512-react"],
  }
}
`;

    const result = await tool().execute({ name: 'framer-motion' });

    expect(files[`${PROJECT}/bun.lock`]).toBe(`{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "test-project",
      "dependencies": {
        "framer-motion": "^12.0.0",
        "react": "^19.0.0",
      },
    },
  },
  "packages": {
    "framer-motion": ["framer-motion@12.0.0", "", { "dependencies": { "motion-dom": "^12.0.0", "tslib": "^2.4.0" }, "peerDependencies": { "react": "^18 || ^19" } }, "sha512-framer-motion-12.0.0"],

    "motion-dom": ["motion-dom@12.1.0", "", { "dependencies": { "tslib": "^2.0.0" } }, "sha512-motion-dom-12.1.0"],

    "react": ["react@19.0.0", "", {}, "sha512-react"],

    "tslib": ["tslib@2.8.1", "", {}, "sha512-tslib-2.8.1"],
  }
}
`);
    expect(result.content).toContain('Updated: package.json, bun.lock');
  });

  it('should leave lockfiles it cannot update alone, and say so', async () => {
    writePackageJson({});
    files[`${PROJECT}/pnpm-lock.yaml`] = "lockfileVersion: '9.0'\n";

    const result = await tool().execute({ name: 'lodash' });

    expect(files[`${PROJECT}/pnpm-lock.yaml`]).toBe("lockfileVersion: '9.0'\n");
    expect(result.content).toContain('Updated: package.json\n');
    expect(result.content).toContain('pnpm-lock.yaml was not updated');
  });

  it('should write nothing if a dependency cannot be resolved', async () => {
    writePackageJson({});
    files[`${PROJECT}/package-lock.json`] = packageLock({ '': { name: 'test-project', version: '1.0.0' } });
    const before = { ...files };
    vi.stubGlobal('fetch', mockRegistry({ ...registry, 'motion-dom': { latest: '1.0.0', versions: { '1.0.0': {} } } }));

    await expect(tool().execute({ name: 'framer-motion' })).rejects.toThrow('No version of motion-dom matches ^12.0.0');
    expect(files).toEqual(before);
  });

  it('should fail on a corrupted package-lock.json without writing anything', async () => {
    writePackageJson({});
    files[`${PROJECT}/package-lock.json`] = 'invalid json';
    const before = { ...files };

    await expect(tool().execute({ name: 'lodash' })).rejects.toThrow("Could not install lodash@4.17.21's dependencies");
    expect(files).toEqual(before);
  });
});
