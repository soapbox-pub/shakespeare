import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { Buffer } from 'buffer';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

// Polyfill Buffer for browser
if (typeof window !== 'undefined') {
  (window as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

// const GIT_TEMPLATE_URL = 'https://relay.ngit.dev/npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p/mkstack.git';
const GIT_TEMPLATE_URL = 'https://relay.ngit.dev/npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p/lovable-blank.git';

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  lastModified: Date;
}

export class ProjectsManager {
  fs: JSRuntimeFS;
  dir: string;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
    this.dir = '/projects';
  }

  async init() {
    try {
      await this.fs.mkdir(this.dir);
    } catch {
      // Directory might already exist
    }
  }

  async createProject(name: string): Promise<Project> {
    const id = this.generateProjectId(name);
    const projectPath = `${this.dir}/${id}`;

    await this.fs.mkdir(projectPath);

    const project: Project = {
      id,
      name,
      path: projectPath,
      createdAt: new Date(),
      lastModified: new Date(),
    };

    // Save project metadata
    await this.fs.writeFile(
      `${projectPath}/.project.json`,
      JSON.stringify(project, null, 2)
    );

    // Clone the template
    await this.cloneTemplate(projectPath);

    return project;
  }

  async cloneTemplate(projectPath: string) {
    await git.clone({
      fs: this.fs,
      http,
      dir: projectPath,
      url: GIT_TEMPLATE_URL,
      singleBranch: true,
      depth: 1,
    });
  }

  async getProjects(): Promise<Project[]> {
    try {
      const projectDirs = await this.fs.readdir(this.dir);
      const projects: Project[] = [];

      for (const dir of projectDirs) {
        const projectPath = `${this.dir}/${dir}`;
        const projectFile = `${projectPath}/.project.json`;

        try {
          const projectData = await this.fs.readFile(projectFile, 'utf8');
          const project = JSON.parse(projectData);
          projects.push({
            ...project,
            createdAt: new Date(project.createdAt),
            lastModified: new Date(project.lastModified),
          });
        } catch {
          // Skip invalid projects
        }
      }

      return projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
      return [];
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const projectFile = `${this.dir}/${id}/.project.json`;
      const projectData = await this.fs.readFile(projectFile, 'utf8');
      const project = JSON.parse(projectData);
      return {
        ...project,
        createdAt: new Date(project.createdAt),
        lastModified: new Date(project.lastModified),
      };
    } catch {
      return null;
    }
  }

  async readFile(projectId: string, filePath: string): Promise<string> {
    const fullPath = `${this.dir}/${projectId}/${filePath}`;
    try {
      const stat = await this.fs.stat(fullPath);
      if (stat.isFile()) {
        return await this.fs.readFile(fullPath, 'utf8');
      } else {
        throw new Error(`Path is not a file: ${filePath}`);
      }
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    const fullPath = `${this.dir}/${projectId}/${filePath}`;
    const dir = fullPath.split('/').slice(0, -1).join('/');
    await this.fs.mkdir(dir);
    await this.fs.writeFile(fullPath, content);

    // Update last modified
    await this.updateProjectLastModified(projectId);
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    const fullPath = `${this.dir}/${projectId}/${filePath}`;
    await this.fs.unlink(fullPath);
    await this.updateProjectLastModified(projectId);
  }

  async listFiles(projectId: string, dirPath: string = ''): Promise<string[]> {
    const fullPath = `${this.dir}/${projectId}/${dirPath}`;
    try {
      return await this.fs.readdir(fullPath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async fileExists(projectId: string, filePath: string): Promise<boolean> {
    try {
      const fullPath = `${this.dir}/${projectId}/${filePath}`;
      await this.fs.stat(fullPath);
      return true;
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return false;
      }
      // For other errors, we still want to know the file doesn't exist
      return false;
    }
  }

  private generateProjectId(name: string): string {
    const timestamp = Date.now().toString(36);
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${slug}-${timestamp}`;
  }

  private async updateProjectLastModified(projectId: string): Promise<void> {
    try {
      const projectFile = `${this.dir}/${projectId}/.project.json`;
      const projectData = await this.fs.readFile(projectFile, 'utf8');
      const project = JSON.parse(projectData);
      project.lastModified = new Date().toISOString();
      await this.fs.writeFile(projectFile, JSON.stringify(project, null, 2));
    } catch {
      // Ignore errors updating last modified
    }
  }
}