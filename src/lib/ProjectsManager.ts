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

interface ProjectMetadata {
  name: string;
  createdAt: string;
  lastModified: string;
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
    const id = await this.generateUniqueProjectId(name);
    const projectPath = `${this.dir}/${id}`;

    await this.fs.mkdir(projectPath);

    const now = new Date();
    const metadata: ProjectMetadata = {
      name,
      createdAt: now.toISOString(),
      lastModified: now.toISOString(),
    };

    // Clone the template first
    await this.cloneTemplate(projectPath);

    // Save project metadata in .git directory to keep it out of source tree
    const gitDir = `${projectPath}/.git`;
    await this.fs.writeFile(
      `${gitDir}/project.json`,
      JSON.stringify(metadata, null, 2)
    );

    // Return the full project object with dynamically generated properties
    return {
      id,
      name,
      path: projectPath,
      createdAt: now,
      lastModified: now,
    };
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
        const projectFile = `${projectPath}/.git/project.json`;

        try {
          const projectData = await this.fs.readFile(projectFile, 'utf8');
          const metadata: ProjectMetadata = JSON.parse(projectData);

          // Generate dynamic properties
          const project: Project = {
            id: dir, // basename of the path
            name: metadata.name,
            path: projectPath,
            createdAt: new Date(metadata.createdAt),
            lastModified: new Date(metadata.lastModified),
          };

          projects.push(project);
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
      const projectPath = `${this.dir}/${id}`;
      const projectFile = `${projectPath}/.git/project.json`;
      const projectData = await this.fs.readFile(projectFile, 'utf8');
      const metadata: ProjectMetadata = JSON.parse(projectData);

      // Generate dynamic properties
      return {
        id, // basename of the path
        name: metadata.name,
        path: projectPath,
        createdAt: new Date(metadata.createdAt),
        lastModified: new Date(metadata.lastModified),
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

  async deleteProject(projectId: string): Promise<void> {
    const projectPath = `${this.dir}/${projectId}`;

    // Recursively delete the project directory
    await this.deleteDirectory(projectPath);
  }

  private async deleteDirectory(dirPath: string): Promise<void> {
    try {
      const files = await this.fs.readdir(dirPath);

      for (const file of files) {
        const fullPath = `${dirPath}/${file}`;
        const stat = await this.fs.stat(fullPath);

        if (stat.isDirectory()) {
          await this.deleteDirectory(fullPath);
        } else {
          await this.fs.unlink(fullPath);
        }
      }

      await this.fs.rmdir(dirPath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async generateUniqueProjectId(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // First try the base slug
    let slug = baseSlug;
    let counter = 1;

    // Check if the directory already exists, if so, add a number
    while (await this.projectExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async projectExists(id: string): Promise<boolean> {
    try {
      const projectPath = `${this.dir}/${id}`;
      await this.fs.stat(projectPath);
      return true;
    } catch {
      return false;
    }
  }

  async getNostrRepoAddress(projectId: string): Promise<string | null> {
    try {
      const projectPath = `${this.dir}/${projectId}`;
      const config = await git.getConfig({
        fs: this.fs,
        dir: projectPath,
        path: 'nostr.repo',
      });
      return config || null;
    } catch {
      return null;
    }
  }

  async isNostrEnabled(projectId: string): Promise<boolean> {
    const naddr = await this.getNostrRepoAddress(projectId);
    return naddr !== null;
  }

  private async updateProjectLastModified(projectId: string): Promise<void> {
    try {
      const projectFile = `${this.dir}/${projectId}/.git/project.json`;
      const projectData = await this.fs.readFile(projectFile, 'utf8');
      const metadata: ProjectMetadata = JSON.parse(projectData);
      metadata.lastModified = new Date().toISOString();
      await this.fs.writeFile(projectFile, JSON.stringify(metadata, null, 2));
    } catch {
      // Ignore errors updating last modified
    }
  }
}