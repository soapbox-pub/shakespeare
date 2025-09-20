import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectsManager } from './ProjectsManager';

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
class MockFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set();

  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    if (encoding === 'utf8' && typeof content === 'string') {
      return content;
    }
    return content;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
    // Ensure parent directory exists
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      this.dirs.add(dir);
    }
  }

  async readdir(path: string): Promise<string[]> {
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

    return [...new Set(entries)];
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
}

describe('ProjectsManager', () => {
  let fs: MockFS;
  let projectsManager: ProjectsManager;

  beforeEach(() => {
    fs = new MockFS();
    projectsManager = new ProjectsManager(fs as unknown as import('./JSRuntime').JSRuntimeFS);
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
  });
});