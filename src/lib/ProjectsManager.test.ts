import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectsManager } from './ProjectsManager';

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

  describe('getProjects with fallback detection', () => {
    it('should detect projects with metadata files', async () => {
      await projectsManager.init();

      // Create a project with metadata
      await fs.mkdir('/projects/test-project');
      await fs.mkdir('/projects/test-project/.git');
      await fs.writeFile('/projects/test-project/.git/project.json', JSON.stringify({
        name: 'Test Project',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModified: '2024-01-01T00:00:00.000Z',
      }));

      const projects = await projectsManager.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Test Project');
      expect(projects[0].id).toBe('test-project');
    });

    it('should detect any directory as a project without metadata files', async () => {
      await projectsManager.init();

      // Create any directory without metadata
      await fs.mkdir('/projects/cloned-repo');

      const projects = await projectsManager.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Cloned Repo'); // Formatted from directory name
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
      expect(projectNames).toEqual(['Another Project', 'Empty Folder', 'My Project']);
    });

    it('should format project names correctly', async () => {
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

      expect(awesomeProject?.name).toBe('My Awesome Project');
      expect(simpleProject?.name).toBe('Simple Name');
    });
  });

  describe('getProject with fallback detection', () => {
    it('should get project with metadata file', async () => {
      await projectsManager.init();

      // Create a project with metadata
      await fs.mkdir('/projects/test-project');
      await fs.mkdir('/projects/test-project/.git');
      await fs.writeFile('/projects/test-project/.git/project.json', JSON.stringify({
        name: 'Test Project',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastModified: '2024-01-01T00:00:00.000Z',
      }));

      const project = await projectsManager.getProject('test-project');
      expect(project).not.toBeNull();
      expect(project?.name).toBe('Test Project');
    });

    it('should get any directory as a project without metadata file', async () => {
      await projectsManager.init();

      // Create any directory without metadata
      await fs.mkdir('/projects/cloned-repo');

      const project = await projectsManager.getProject('cloned-repo');
      expect(project).not.toBeNull();
      expect(project?.name).toBe('Cloned Repo');
    });

    it('should return null for non-existent projects', async () => {
      await projectsManager.init();

      const project = await projectsManager.getProject('non-existent');
      expect(project).toBeNull();
    });
  });
});