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

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set();

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, encoding: "utf8"): Promise<string>;
  async readFile(path: string, encoding: string): Promise<string | Uint8Array>;
  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
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
    projectsManager = new ProjectsManager({ fs, git });
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
});