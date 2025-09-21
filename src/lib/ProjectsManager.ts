import { Buffer } from 'buffer';
import type { Git } from '@/lib/git';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

// Polyfill Buffer for browser
if (typeof window !== 'undefined') {
  (window as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

// const GIT_TEMPLATE_URL = 'https://relay.ngit.dev/npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p/mkstack.git';
const GIT_TEMPLATE_URL = 'https://gitlab.com/soapbox-pub/mkstack.git';

export interface Project {
  id: string;
  name: string;
  path: string;
  lastModified: Date;
}

export interface ProjectsManagerOptions {
  fs: JSRuntimeFS;
  git: Git;
}

export class ProjectsManager {
  fs: JSRuntimeFS;
  git: Git;
  dir: string;

  constructor(options: ProjectsManagerOptions) {
    this.fs = options.fs;
    this.git = options.git;
    this.dir = '/projects';
  }

  async init() {
    try {
      await this.fs.mkdir(this.dir);
    } catch {
      // Directory might already exist
    }
  }

  async createProject(name: string, customId?: string): Promise<Project> {
    const project = await this.cloneProject(name, GIT_TEMPLATE_URL, customId, { depth: 1 });

    try {
      await this.fs.mkdir(this.dir + `/${project.id}/.ai/history`, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Delete README.md if it exists
    try {
      await this.fs.unlink(`${project.path}/README.md`);
    } catch {
      // README.md might not exist, ignore error
    }

    // Delete .git directory and reinitialize
    try {
      await this.deleteDirectory(`${project.path}/.git`);
    } catch {
      // .git directory might not exist, ignore error
    }

    // Initialize new git repository
    await this.git.init({
      dir: project.path,
      defaultBranch: 'main',
    });

    // Add all files to git
    const files = await this.getAllFiles(project.path);
    for (const file of files) {
      // Skip .git directory and other hidden files we don't want to track
      if (!file.startsWith('.git/') && !file.startsWith('.ai/')) {
        await this.git.add({
          dir: project.path,
          filepath: file,
        });
      }
    }

    // Make initial commit
    await this.git.commit({
      dir: project.path,
      message: 'New project created with Shakespeare',
      author: {
        name: 'shakespeare.diy',
        email: 'assistant@shakespeare.diy',
      },
    });

    return project;
  }

  async cloneProject(name: string, repoUrl: string, customId?: string, options?: { depth?: number }): Promise<Project> {
    const id = customId || await this.generateUniqueProjectId(name);

    // Check if project with this ID already exists when using custom ID
    if (customId && await this.projectExists(id)) {
      throw new Error(`Project with ID "${id}" already exists`);
    }

    const projectPath = `${this.dir}/${id}`;

    await this.fs.mkdir(projectPath);

    // Clone the repository
    await this.git.clone({
      dir: projectPath,
      url: repoUrl,
      singleBranch: true,
      depth: options?.depth, // Use depth if provided, otherwise clone full history
    });

    // Get filesystem stats for timestamps
    const stats = await this.fs.stat(projectPath);
    const timestamp = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();

    // Return the full project object with dynamically generated properties
    return {
      id,
      name: this.formatProjectName(id), // Use formatted directory name
      path: projectPath,
      lastModified: timestamp,
    };
  }

  async getProjects(): Promise<Project[]> {
    try {
      const projectDirs = await this.fs.readdir(this.dir);
      const projects: Project[] = [];

      for (const dir of projectDirs) {
        const projectPath = `${this.dir}/${dir}`;

        try {
          const stats = await this.fs.stat(projectPath);
          if (stats.isDirectory()) {
            const modifiedDate = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();
            const project: Project = {
              id: dir, // basename of the path
              name: this.formatProjectName(dir), // Convert directory name to readable format
              path: projectPath,
              lastModified: modifiedDate,
            };

            projects.push(project);
          }
        } catch {
          // Skip if we can't stat the directory
        }
      }

      return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch {
      return [];
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const projectPath = `${this.dir}/${id}`;
      const stats = await this.fs.stat(projectPath);

      if (stats.isDirectory()) {
        const modifiedDate = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();
        return {
          id, // basename of the path
          name: this.formatProjectName(id), // Convert directory name to readable format
          path: projectPath,
          lastModified: modifiedDate,
        };
      }

      return null;
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

  async readFileBytes(projectId: string, filePath: string): Promise<Uint8Array> {
    const fullPath = `${this.dir}/${projectId}/${filePath}`;
    try {
      const stat = await this.fs.stat(fullPath);
      if (stat.isFile()) {
        return await this.fs.readFile(fullPath);
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
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    const fullPath = `${this.dir}/${projectId}/${filePath}`;
    await this.fs.unlink(fullPath);
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
    const files = await this.fs.readdir(dirPath);

    for (const file of files) {
      const fullPath = `${dirPath}/${file}`;
      const stat = await this.fs.lstat(fullPath);

      if (stat.isDirectory()) {
        await this.deleteDirectory(fullPath);
      } else {
        await this.fs.unlink(fullPath);
      }
    }

    await this.fs.rmdir(dirPath);
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
      const config = await this.git.getConfig({
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

  private formatProjectName(dirName: string): string {
    // Return the original directory name without formatting
    return dirName;
  }

  private async getAllFiles(dirPath: string, relativePath: string = ''): Promise<string[]> {
    const files: string[] = [];
    const entries = await this.fs.readdir(dirPath);

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry}`;
      const relativeFilePath = relativePath ? `${relativePath}/${entry}` : entry;

      try {
        const stat = await this.fs.lstat(fullPath);

        if (stat.isDirectory()) {
          // Recursively get files from subdirectories
          const subFiles = await this.getAllFiles(fullPath, relativeFilePath);
          files.push(...subFiles);
        } else if (stat.isFile()) {
          files.push(relativeFilePath);
        }
      } catch {
        // Skip files we can't stat
      }
    }

    return files;
  }
}