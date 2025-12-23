import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectsManager } from './ProjectsManager';
import { JSRuntimeFS } from './JSRuntime';
import { Git } from './git';
import type { NPool } from '@nostrify/nostrify';

const createMockNostr = (): NPool => ({
  req: vi.fn(),
  query: vi.fn(),
  event: vi.fn(),
  group: vi.fn(),
  relay: vi.fn(),
  relays: new Map(),
  close: vi.fn(),
}) as unknown as NPool;

// Mock JSZip
vi.mock('jszip', () => ({
  default: class MockJSZip {
    files: Record<string, { dir: boolean; async: () => Uint8Array }> = {};

    static async loadAsync(buffer: ArrayBuffer) {
      const instance = new MockJSZip();
      // Add a mock file entry
      instance.files['package.json'] = {
        dir: false,
        async: () => new Uint8Array(buffer)
      };
      return instance;
    }

    async file(name: string) {
      return this.files[name];
    }
  }
}));

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set();

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    const encoding = typeof options === 'string' ? options : options?.encoding;
    if (encoding === 'utf8') {
      if (typeof content === 'string') {
        return content;
      }
      // Convert Uint8Array to string
      return new TextDecoder('utf-8').decode(content as Uint8Array);
    }
    if (typeof content === 'string') {
      // Convert string to Uint8Array
      return new TextEncoder().encode(content);
    }
    return content as Uint8Array;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
    // Ensure parent directory exists
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      this.dirs.add(dir);
    }
  }

  // @ts-expect-error I don't know how to type this properly
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | DirectoryEntry[]> {
    if (!this.dirs.has(path)) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    const entries: string[] = [];

    // Find subdirectories
    for (const dir of this.dirs) {
      if (dir.startsWith(path + '/') && !dir.slice(path.length + 1).includes('/')) {
        entries.push(dir.slice(path.length + 1));
      }
    }

    // Find files
    for (const file of this.files.keys()) {
      if (file.startsWith(path + '/') && !file.slice(path.length + 1).includes('/')) {
        entries.push(file.slice(path.length + 1));
      }
    }

    const uniqueEntries = [...new Set(entries)];

    if (options && options.withFileTypes) {
      // Provide a minimal DirectoryEntry mock
      return uniqueEntries.map(name => {
        const fullPath = path.endsWith('/') ? path + name : path + '/' + name;
        const isDir = this.dirs.has(fullPath);
        return {
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
        } as unknown as DirectoryEntry;
      });
    }

    return uniqueEntries;
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; mtimeMs?: number }> {
    if (this.dirs.has(path)) {
      return {
        isDirectory: () => true,
        isFile: () => false,
        mtimeMs: Date.now(),
      };
    }
    if (this.files.has(path)) {
      return {
        isDirectory: () => false,
        isFile: () => true,
        mtimeMs: Date.now(),
      };
    }
    const error = new Error(`ENOENT: no such file or directory, stat '${path}'`) as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rmdir(path: string): Promise<void> {
    this.dirs.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    // Handle both files and directories
    if (this.files.has(oldPath)) {
      const content = this.files.get(oldPath);
      this.files.delete(oldPath);
      this.files.set(newPath, content!);
    }

    if (this.dirs.has(oldPath)) {
      this.dirs.delete(oldPath);
      this.dirs.add(newPath);

      // Also move all subdirectories and files
      const itemsToMove: Array<{ oldPath: string; newPath: string; isDir: boolean }> = [];

      // Collect directories to move
      for (const dir of this.dirs) {
        if (dir.startsWith(oldPath + '/')) {
          const relativePath = dir.slice(oldPath.length);
          itemsToMove.push({
            oldPath: dir,
            newPath: newPath + relativePath,
            isDir: true
          });
        }
      }

      // Collect files to move
      for (const file of this.files.keys()) {
        if (file.startsWith(oldPath + '/')) {
          const relativePath = file.slice(oldPath.length);
          itemsToMove.push({
            oldPath: file,
            newPath: newPath + relativePath,
            isDir: false
          });
        }
      }

      // Move all items
      for (const item of itemsToMove) {
        if (item.isDir) {
          this.dirs.delete(item.oldPath);
          this.dirs.add(item.newPath);
        } else {
          const content = this.files.get(item.oldPath);
          this.files.delete(item.oldPath);
          this.files.set(item.newPath, content!);
        }
      }
    }
  }

  async lstat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean; mtimeMs?: number }> {
    return this.stat(path);
  }
}

describe('ProjectsManager', () => {
  let fs: JSRuntimeFS;
  let git: Git;
  let nostr: NPool;
  let projectsManager: ProjectsManager;

  beforeEach(() => {
    fs = new MockFS() as unknown as JSRuntimeFS;
    nostr = createMockNostr();
    git = new Git({ fs, nostr });
    projectsManager = new ProjectsManager({ fs, git, projectsPath: '/projects', templatesPath: '/templates' });
  });

  describe('getProjects', () => {
    it('should detect any directory as a project', async () => {
      await projectsManager.init();

      // Create any directory
      await fs.mkdir('/projects/cloned-repo');

      const projects = await projectsManager.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('cloned-repo'); // Preserve original directory name
      expect(projects[0].id).toBe('cloned-repo');
    });

    it('should detect all directories as projects', async () => {
      await projectsManager.init();

      // Create various directories
      await fs.mkdir('/projects/my-project');
      await fs.mkdir('/projects/another-project');
      await fs.mkdir('/projects/empty-folder');

      const projects = await projectsManager.getProjects();
      expect(projects).toHaveLength(3);

      const projectNames = projects.map(p => p.name).sort();
      expect(projectNames).toEqual(['another-project', 'empty-folder', 'my-project']);
    });

    it('should preserve original project names', async () => {
      await projectsManager.init();

      // Create projects with various naming patterns
      await fs.mkdir('/projects/my-awesome-project');
      await fs.mkdir('/projects/my-awesome-project/.git');
      await fs.writeFile('/projects/my-awesome-project/package.json', '{}');

      await fs.mkdir('/projects/simple-name');
      await fs.mkdir('/projects/simple-name/.git');
      await fs.writeFile('/projects/simple-name/package.json', '{}');

      const projects = await projectsManager.getProjects();
      expect(projects).toHaveLength(2);

      const awesomeProject = projects.find(p => p.id === 'my-awesome-project');
      const simpleProject = projects.find(p => p.id === 'simple-name');

      expect(awesomeProject?.name).toBe('my-awesome-project');
      expect(simpleProject?.name).toBe('simple-name');
    });
  });

  describe('getProject', () => {
    it('should get any directory as a project', async () => {
      await projectsManager.init();

      // Create any directory
      await fs.mkdir('/projects/cloned-repo');

      const project = await projectsManager.getProject('cloned-repo');
      expect(project).not.toBeNull();
      expect(project?.name).toBe('cloned-repo');
      expect(project?.id).toBe('cloned-repo');
    });

    it('should return null for non-existent projects', async () => {
      await projectsManager.init();

      const project = await projectsManager.getProject('non-existent');
      expect(project).toBeNull();
    });
  });

  describe('importProjectFromZip', () => {
    it('should preserve original project name when overwriting', async () => {
      await projectsManager.init();

      // Create an existing project with a specific name
      await fs.mkdir('/projects/my-project');
      await fs.mkdir('/projects/my-project/.git');
      await fs.writeFile('/projects/my-project/package.json', '{"name": "original-name"}');

      // Mock the git methods to simulate existing project
      const mockGit = {
        init: vi.fn(),
        clone: vi.fn(),
        add: vi.fn(),
        commit: vi.fn(),
        getConfig: vi.fn(),
        getAllFiles: vi.fn().mockResolvedValue(['package.json']),
      } as Partial<import('./git').Git>;

      // Replace git instance
      Object.assign(projectsManager, { git: mockGit });

      // Create a mock ZIP file with different name
      const zipFile = new File(['test content'], 'different-name.zip', { type: 'application/zip' });

      // Mock arrayBuffer method
      Object.defineProperty(zipFile, 'arrayBuffer', {
        value: () => Promise.resolve(new TextEncoder().encode('test content').buffer),
        writable: false
      });

      // Import with overwrite
      const project = await projectsManager.importProjectFromZip(zipFile, 'my-project', true);

      // Should preserve original project name
      expect(project.name).toBe('my-project');
      expect(project.id).toBe('my-project');
    });

    it('should use new project name when not overwriting', async () => {
      await projectsManager.init();

      // Mock the git methods
      const mockGit = {
        init: vi.fn(),
        clone: vi.fn(),
        add: vi.fn(),
        commit: vi.fn(),
        getConfig: vi.fn(),
        getAllFiles: vi.fn().mockResolvedValue(['package.json']),
      } as Partial<import('./git').Git>;

      // Replace git instance
      Object.assign(projectsManager, { git: mockGit });

      // Create a mock ZIP file
      const zipFile = new File(['test content'], 'new-project.zip', { type: 'application/zip' });

      // Mock arrayBuffer method
      Object.defineProperty(zipFile, 'arrayBuffer', {
        value: () => Promise.resolve(new TextEncoder().encode('test content').buffer),
        writable: false
      });

      // Import without overwrite
      const project = await projectsManager.importProjectFromZip(zipFile, undefined, false);

      // Should use formatted name from ID
      expect(project.name).toBe('new-project');
      expect(project.id).toBe('new-project');
    });

    it('should prevent zip slip attacks during import', async () => {
      await projectsManager.init();

      // Mock the git methods
      const mockGit = {
        init: vi.fn(),
        clone: vi.fn(),
        add: vi.fn(),
        commit: vi.fn(),
        getConfig: vi.fn(),
        getAllFiles: vi.fn().mockResolvedValue([]),
      } as Partial<import('./git').Git>;

      // Replace git instance
      Object.assign(projectsManager, { git: mockGit });

      // Create a mock ZIP file that would try to escape the project directory
      const zipFile = new File(['malicious content'], 'malicious.zip', { type: 'application/zip' });

      // Mock JSZip to simulate a malicious ZIP with path traversal
      const JSZip = await import('jszip');

      const mockLoadAsync = vi.fn().mockResolvedValue({
        files: {
          '../../../etc/passwd': {
            dir: false,
            async: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
          },
          '../../outside.txt': {
            dir: false,
            async: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]))
          },
          'safe-file.txt': {
            dir: false,
            async: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9]))
          }
        }
      });

      vi.spyOn(JSZip.default, 'loadAsync').mockImplementation(mockLoadAsync);

      // Mock arrayBuffer method
      Object.defineProperty(zipFile, 'arrayBuffer', {
        value: () => Promise.resolve(new ArrayBuffer(0)),
        writable: false
      });

      // Spy on console.warn to check for security warnings
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Import the malicious ZIP
        const project = await projectsManager.importProjectFromZip(zipFile, undefined, false);

        // Should have completed successfully (safe files extracted)
        expect(project).toBeDefined();

        // Should have logged a security warning about skipped files
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Skipped 2 files due to resolving to paths outside the project direcotry:'),
          ['../../../etc/passwd', '../../outside.txt']
        );

        // Verify that only safe files would be written (check writeFile calls)
        const writeFileCalls = (fs.writeFile as unknown as { mock?: { calls: [string, unknown][] } }).mock?.calls || [];
        const maliciousPaths = writeFileCalls.filter((call: [string, unknown]) =>
          call[0].includes('../') || call[0].includes('etc/passwd') || call[0].includes('outside.txt')
        );
        expect(maliciousPaths).toHaveLength(0);

      } finally {
        // Restore mocks
        consoleSpy.mockRestore();
        vi.restoreAllMocks();
      }
    });
  });

  describe('cloneProject', () => {
    it('should clean up project directory when clone fails', async () => {
      await projectsManager.init();

      // Mock git.clone to fail
      const mockGit = {
        clone: vi.fn().mockRejectedValue(new Error('Clone failed')),
      } as Partial<import('./git').Git>;

      // Replace git instance
      Object.assign(projectsManager, { git: mockGit });

      // Attempt to clone a project
      await expect(projectsManager.cloneProject({
        name: 'test-project',
        repoUrl: 'https://github.com/test/repo.git',
      }))
        .rejects.toThrow('Clone failed');

      // Verify that the project directory was cleaned up
      const project = await projectsManager.getProject('test-project');
      expect(project).toBeNull();

      // Verify directory doesn't exist in filesystem
      await expect(fs.stat('/projects/test-project')).rejects.toThrow('ENOENT');
    });

    it('should handle cleanup errors gracefully', async () => {
      await projectsManager.init();

      // Mock git.clone to fail
      const mockGit = {
        clone: vi.fn().mockRejectedValue(new Error('Clone failed')),
      } as Partial<import('./git').Git>;

      // Replace git instance
      Object.assign(projectsManager, { git: mockGit });

      // Spy on console.warn to check for cleanup warnings
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock fs.rmdir to fail (simulate cleanup error)
      const originalRmdir = fs.rmdir;
      fs.rmdir = vi.fn().mockRejectedValue(new Error('Cleanup failed'));

      try {
        // Attempt to clone a project
        await expect(projectsManager.cloneProject({
          name: 'test-project',
          repoUrl: 'https://github.com/test/repo.git',
        }))
          .rejects.toThrow('Clone failed');

        // Should have logged a cleanup warning
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to clean up directory after clone failure:',
          expect.any(Error)
        );

      } finally {
        // Restore mocks
        consoleSpy.mockRestore();
        fs.rmdir = originalRmdir;
      }
    });
  });

  describe('renameProject', () => {
    it('should rename a project directory', async () => {
      await projectsManager.init();

      // Create a project
      await fs.mkdir('/projects/old-name');
      await fs.writeFile('/projects/old-name/package.json', '{}');

      // Verify the project exists
      const originalProject = await projectsManager.getProject('old-name');
      expect(originalProject).not.toBeNull();

      // Rename the project
      const renamedProject = await projectsManager.renameProject('old-name', 'new-name');

      // Verify the renamed project
      expect(renamedProject.id).toBe('new-name');
      expect(renamedProject.name).toBe('new-name');
      expect(renamedProject.path).toBe('/projects/new-name');

      // Verify old project no longer exists
      const oldProject = await projectsManager.getProject('old-name');
      expect(oldProject).toBeNull();

      // Verify new project exists
      const newProject = await projectsManager.getProject('new-name');
      expect(newProject).not.toBeNull();
      expect(newProject?.id).toBe('new-name');
    });

    it('should throw error when old project does not exist', async () => {
      await projectsManager.init();

      await expect(projectsManager.renameProject('non-existent', 'new-name'))
        .rejects.toThrow('Project with ID "non-existent" does not exist');
    });

    it('should throw error when new project name already exists', async () => {
      await projectsManager.init();

      // Create two projects
      await fs.mkdir('/projects/project-1');
      await fs.mkdir('/projects/project-2');

      await expect(projectsManager.renameProject('project-1', 'project-2'))
        .rejects.toThrow('Project with ID "project-2" already exists');
    });

    it('should validate and normalize project names', async () => {
      await projectsManager.init();

      // Create a project
      await fs.mkdir('/projects/old-name');

      // Try to rename with invalid characters
      await expect(projectsManager.renameProject('old-name', 'New Name With Spaces'))
        .rejects.toThrow('Project name must contain only lowercase letters, numbers, and hyphens');

      // Try to rename with empty name
      await expect(projectsManager.renameProject('old-name', ''))
        .rejects.toThrow('Project name cannot be empty');
    });
  });
});