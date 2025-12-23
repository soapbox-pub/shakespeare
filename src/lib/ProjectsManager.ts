import { Buffer } from 'buffer';
import JSZip from 'jszip';
import { Git } from '@/lib/git';
import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { ensurePersistentStorage } from '@/lib/persistentStorage';
import { DotAI } from '@/lib/DotAI';

// Polyfill Buffer for browser
if (typeof window !== 'undefined') {
  (window as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  lastModified: Date;
}

export interface ProjectsManagerOptions {
  fs: JSRuntimeFS;
  git: Git;
  /** Projects directory path (default: /projects) */
  projectsPath: string;
  /** Templates directory path (default: /templates) */
  templatesPath: string;
}

export class ProjectsManager {
  fs: JSRuntimeFS;
  git: Git;
  dir: string;
  templatesDir: string;

  constructor(options: ProjectsManagerOptions) {
    this.fs = options.fs;
    this.git = options.git;
    this.dir = options.projectsPath;
    this.templatesDir = options.templatesPath;
  }

  async init() {
    try {
      await this.fs.mkdir(this.dir);
    } catch {
      // Directory might already exist
    }
    try {
      await this.fs.mkdir(this.templatesDir);
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Ensure a template is cached locally and up-to-date.
   * Returns the path to the cached template.
   *
   * @param templateUrl - Git repository URL of the template
   * @param onUpdateError - Optional callback when template update fails (non-critical)
   * @returns Path to the cached template directory
   */
  async updateTemplate(templateUrl: string, onUpdateError?: (error: Error) => void): Promise<string> {
    // Generate a safe directory name from the template URL
    const templateName = this.getTemplateNameFromUrl(templateUrl);
    const templatePath = `${this.templatesDir}/${templateName}`;

    try {
      // Check if template already exists
      await this.fs.stat(templatePath);

      // Template exists, try to update it with force pull
      try {
        await this.forcePullTemplate(templatePath);
      } catch (updateError) {
        // Update failed, but we can continue with the existing template
        console.warn(`Failed to update template at ${templatePath}:`, updateError);
        if (onUpdateError) {
          onUpdateError(updateError instanceof Error ? updateError : new Error(String(updateError)));
        }
      }
    } catch {
      // Template doesn't exist, clone it shallowly
      await this.fs.mkdir(templatePath, { recursive: true });

      try {
        await this.git.clone({
          dir: templatePath,
          url: templateUrl,
          singleBranch: true,
          depth: 1,
        });
      } catch (cloneError) {
        // Clean up on clone failure
        try {
          await this.deleteDirectory(templatePath);
        } catch {
          // Ignore cleanup errors
        }
        throw cloneError;
      }
    }

    return templatePath;
  }

  /**
   * Force pull the template repository to match remote, discarding any local changes.
   * This ensures the template is always up-to-date with the remote.
   *
   * Since templates are cloned with depth=1 (shallow), we can't use merge because
   * isomorphic-git can't verify the commit history. Instead, we fetch and directly
   * checkout the remote branch, which is safe since we always want templates to
   * exactly match the remote.
   */
  private async forcePullTemplate(templatePath: string): Promise<void> {
    // Fetch the latest changes from remote (shallow fetch for efficiency)
    const fetchResult = await this.git.fetch({
      dir: templatePath,
      singleBranch: true,
      depth: 1,
    });

    // Get the current branch name (e.g., "refs/heads/main")
    const branchRef = fetchResult.defaultBranch;

    if (!branchRef) {
      throw new Error('Could not determine current branch');
    }

    // Extract just the branch name (e.g., "main" from "refs/heads/main")
    const branchName = branchRef.replace(/^refs\/heads\//, '');

    // Get the remote ref OID
    // The fetch stores it as refs/remotes/origin/{branchName}, not refs/remotes/origin/refs/heads/{branchName}
    const remoteRef = `refs/remotes/origin/${branchName}`;
    const remoteOid = await this.git.resolveRef({
      dir: templatePath,
      ref: remoteRef,
    });

    // Update the local branch ref to point to the remote commit
    await this.git.writeRef({
      dir: templatePath,
      ref: branchRef, // Use the full ref like "refs/heads/main"
      value: remoteOid,
      force: true,
    });

    // Directly checkout the remote commit to update working directory
    // This bypasses merge entirely and just makes the working directory
    // match the remote commit exactly. Safe for templates.
    // Using force: true to overwrite any local changes
    await this.git.checkout({
      dir: templatePath,
      ref: remoteOid,
      force: true,
    });
  }

  /**
   * Generate a safe directory name from a template URL
   */
  private getTemplateNameFromUrl(url: string): string {
    // Extract a meaningful name from the URL
    // e.g., "https://gitlab.com/soapbox-pub/mkstack.git" -> "mkstack"
    // e.g., "nostr://alex@gleasonator.dev/shakespeare.diy/mkstack" -> "mkstack"

    let name = url;

    // Remove .git suffix if present
    name = name.replace(/\.git$/, '');

    // Remove trailing slash
    name = name.replace(/\/$/, '');

    // Extract the last part of the path
    const parts = name.split('/');
    name = parts[parts.length - 1] || '';

    // Sanitize the name to be filesystem-safe
    name = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!name) {
      throw new Error(`Could not derive template name from URL: ${url}`);
    }

    return name;
  }

  /**
   * Copy a directory recursively from source to destination
   * @param skipGit - Whether to skip the .git directory (default: true)
   */
  private async copyDirectory(sourcePath: string, destPath: string, skipGit = true): Promise<void> {
    // Ensure destination directory exists
    await this.fs.mkdir(destPath, { recursive: true });

    const entries = await this.fs.readdir(sourcePath);

    for (const entry of entries) {
      // Skip .git directory if skipGit is true
      if (skipGit && entry === '.git') continue;

      const sourceFullPath = `${sourcePath}/${entry}`;
      const destFullPath = `${destPath}/${entry}`;

      try {
        const stat = await this.fs.lstat(sourceFullPath);

        if (stat.isDirectory()) {
          // Recursively copy subdirectories
          await this.copyDirectory(sourceFullPath, destFullPath, skipGit);
        } else if (stat.isFile()) {
          // Copy file
          const content = await this.fs.readFile(sourceFullPath);
          await this.fs.writeFile(destFullPath, content);
        }
      } catch (error) {
        console.warn(`Failed to copy ${sourceFullPath}:`, error);
        // Continue copying other files
      }
    }
  }

  async createProject(name: string, templateUrl: string, customId?: string, onTemplateUpdateError?: (error: Error) => void, templateMetadata?: { name: string; description: string }): Promise<Project> {
    const id = customId || await this.generateUniqueProjectId(name);

    // Check if project with this ID already exists when using custom ID
    if (customId && await this.projectExists(id)) {
      throw new Error(`Project with ID "${id}" already exists`);
    }

    const projectPath = `${this.dir}/${id}`;

    // Ensure template is cached and up-to-date
    const templatePath = await this.updateTemplate(templateUrl, onTemplateUpdateError);

    // Create project directory
    await this.fs.mkdir(projectPath, { recursive: true });

    try {
      // Copy template to project directory (excluding .git)
      await this.copyDirectory(templatePath, projectPath);

      // Delete README.md if it exists
      try {
        await this.fs.unlink(`${projectPath}/README.md`);
      } catch {
        // README.md might not exist, ignore error
      }

      // Initialize new git repository
      await this.git.init({
        dir: projectPath,
        defaultBranch: 'main',
      });

      // Save template metadata to .git/shakespeare/template.json if provided
      if (templateMetadata) {
        try {
          const dotAI = new DotAI(this.fs, projectPath);
          await dotAI.writeTemplate({
            name: templateMetadata.name,
            description: templateMetadata.description,
            url: templateUrl,
          });
        } catch (error) {
          // Don't fail project creation if template metadata save fails
          console.warn('Failed to save template metadata:', error);
        }
      }

      // Add all files to git
      const files = await this.getAllFiles(projectPath);
      for (const file of files) {
        // Skip .git directory
        if (!file.startsWith('.git/')) {
          await this.git.add({
            dir: projectPath,
            filepath: file,
          });
        }
      }

      // Make initial commit
      await this.git.commit({
        dir: projectPath,
        message: 'New project created with Shakespeare',
      });

      // Get filesystem stats for timestamps
      const stats = await this.fs.stat(projectPath);
      const timestamp = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();

      // Automatically request persistent storage after project creation
      try {
        await ensurePersistentStorage();
      } catch (error) {
        // Don't fail project creation if persistent storage request fails
        console.warn('Failed to request persistent storage after project creation:', error);
      }

      return {
        id,
        name: this.formatProjectName(id),
        path: projectPath,
        lastModified: timestamp,
      };
    } catch (error) {
      // Clean up the directory that was created if project creation fails
      try {
        await this.deleteDirectory(projectPath);
      } catch (cleanupError) {
        // Log cleanup error but don't mask the original error
        console.warn('Failed to clean up directory after project creation failure:', cleanupError);
      }
      // Re-throw the original error
      throw error;
    }
  }

  async importProjectFromZip(zipFile: File, customId?: string, overwrite = false): Promise<Project> {
    // Generate a project ID based on the zip file name or use custom ID
    const baseName = zipFile.name.replace(/\.zip$/i, '');
    const generatedId = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Determine the project ID to use
    let id: string;
    if (customId) {
      // Use the provided custom ID (for overwrite scenarios)
      id = customId;
    } else {
      // If no custom ID, generate a unique ID (for new projects)
      id = await this.generateUniqueProjectId(generatedId);
    }

    const projectPath = `${this.dir}/${id}`;
    const projectExists = await this.projectExists(id);

    // Check if project with this ID already exists when not overwriting
    if (projectExists && !overwrite) {
      throw new Error(`Project with ID "${id}" already exists`);
    }

    // Get original project name if overwriting, otherwise use formatted name
    let projectName: string;
    if (overwrite && projectExists) {
      const existingProject = await this.getProject(id);
      projectName = existingProject?.name || this.formatProjectName(id);
    } else {
      projectName = this.formatProjectName(id);
    }

    try {
      // Create project directory (or ensure it exists for overwrite)
      await this.fs.mkdir(projectPath, { recursive: true });

      // If overwriting, delete existing files except .git directory
      if (projectExists && overwrite) {
        const existingFiles = await this.getAllFiles(projectPath);
        for (const file of existingFiles) {
          // Preserve .git directory
          if (!file.startsWith('.git/')) {
            try {
              await this.fs.unlink(`${projectPath}/${file}`);
            } catch {
              // Ignore deletion errors
            }
          }
        }
      }

      // Read the zip file
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Extract all files from the zip with security validation
      const extractedFiles: string[] = [];
      const skippedFiles: string[] = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        // Validate the extraction path is within the project directory
        const extractPath = this.join(projectPath, relativePath);

        if (!this.isPathWithinProject(extractPath, projectPath)) {
          skippedFiles.push(relativePath);
          continue;
        }

        if (zipEntry.dir) {
          // Create the directory structure
          await this.fs.mkdir(extractPath, { recursive: true });
          continue;
        }

        // Extract file content
        const content = await zipEntry.async('uint8array');

        // Ensure parent directory exists
        const dirPath = extractPath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          await this.fs.mkdir(dirPath, { recursive: true });
        }

        // Write the file (this will overwrite existing files)
        await this.fs.writeFile(extractPath, content);
        extractedFiles.push(relativePath);
      }

      if (skippedFiles.length > 0) {
        console.warn(`Skipped ${skippedFiles.length} files due to resolving to paths outside the project direcotry:`, skippedFiles);
      }

      // Get filesystem stats for timestamps
      const stats = await this.fs.stat(projectPath);
      const timestamp = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();

      // Initialize git repository if there's no .git directory
      try {
        await this.fs.stat(`${projectPath}/.git`);

        // If git exists and we're overwriting, stage the new files
        if (overwrite) {
          const projectFiles = await this.getAllFiles(projectPath);
          for (const file of projectFiles) {
            // Skip .git directory
            if (!file.startsWith('.git/')) {
              try {
                await this.git.add({
                  dir: projectPath,
                  filepath: file,
                });
              } catch {
                // Ignore git add errors for files that might be gitignored
              }
            }
          }

          // Make commit for the overwrite
          await this.git.commit({
            dir: projectPath,
            message: `Overwrite project from ${zipFile.name}`,
          });
        }
      } catch {
        // No .git directory found, initialize new repository
        await this.git.init({
          dir: projectPath,
          defaultBranch: 'main',
        });

        // Add all files to git
        const projectFiles = await this.getAllFiles(projectPath);
        for (const file of projectFiles) {
          // Skip .git directory
          if (!file.startsWith('.git/')) {
            await this.git.add({
              dir: projectPath,
              filepath: file,
            });
          }
        }

        // Make initial commit
        await this.git.commit({
          dir: projectPath,
          message: `Import project from ${zipFile.name}`,
        });
      }

      return {
        id,
        name: projectName,
        path: projectPath,
        lastModified: timestamp,
      };
    } catch (error) {
      // Clean up on error (only if this was a new project creation)
      if (!projectExists) {
        try {
          await this.deleteDirectory(projectPath);
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  async cloneProject(options: {
    name: string;
    repoUrl: string;
    customId?: string;
    depth?: number;
    fork?: boolean;
  }): Promise<Project> {
    const { name, repoUrl, customId, depth, fork = false } = options;
    const id = customId || await this.generateUniqueProjectId(name);

    // Check if project with this ID already exists when using custom ID
    if (customId && await this.projectExists(id)) {
      throw new Error(`Project with ID "${id}" already exists`);
    }

    const projectPath = `${this.dir}/${id}`;

    await this.fs.mkdir(projectPath);

    try {
      // Clone the repository (Git class now handles Nostr URIs automatically)
      // When forking, use 'upstream' as the remote name instead of 'origin'
      await this.git.clone({
        dir: projectPath,
        url: repoUrl,
        singleBranch: true,
        depth, // Use depth if provided, otherwise clone full history
        remote: fork ? 'upstream' : undefined, // Use 'upstream' for forks, otherwise defaults to 'origin'
      });

      // Get filesystem stats for timestamps
      const stats = await this.fs.stat(projectPath);
      const timestamp = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();

      // Automatically request persistent storage after project cloning
      try {
        await ensurePersistentStorage();
      } catch (error) {
        // Don't fail project cloning if persistent storage request fails
        console.warn('Failed to request persistent storage after project cloning:', error);
      }

      // Return the full project object with dynamically generated properties
      return {
        id,
        name: this.formatProjectName(id), // Use formatted directory name
        path: projectPath,
        lastModified: timestamp,
      };
    } catch (error) {
      // Clean up the directory that was created if cloning fails
      try {
        await this.deleteDirectory(projectPath);
      } catch (cleanupError) {
        // Log cleanup error but don't mask the original clone error
        console.warn('Failed to clean up directory after clone failure:', cleanupError);
      }
      // Re-throw the original clone error
      throw error;
    }
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

  async renameProject(oldId: string, newId: string): Promise<Project> {
    // Validate that the old project exists
    const oldProject = await this.getProject(oldId);
    if (!oldProject) {
      throw new Error(`Project with ID "${oldId}" does not exist`);
    }

    // Validate that the new ID doesn't already exist
    if (await this.projectExists(newId)) {
      throw new Error(`Project with ID "${newId}" already exists`);
    }

    // Validate the new ID format (same rules as generateUniqueProjectId)
    const validatedNewId = newId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (validatedNewId !== newId) {
      throw new Error(`Project name must contain only lowercase letters, numbers, and hyphens`);
    }

    if (!validatedNewId) {
      throw new Error(`Project name cannot be empty`);
    }

    const oldPath = `${this.dir}/${oldId}`;
    const newPath = `${this.dir}/${newId}`;

    // Rename the directory
    await this.fs.rename(oldPath, newPath);

    // Return the updated project object
    const stats = await this.fs.stat(newPath);
    const timestamp = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();

    return {
      id: newId,
      name: this.formatProjectName(newId),
      path: newPath,
      lastModified: timestamp,
    };
  }

  async duplicateProject(sourceId: string, newName?: string): Promise<Project> {
    // Validate that the source project exists
    const sourceProject = await this.getProject(sourceId);
    if (!sourceProject) {
      throw new Error(`Project with ID "${sourceId}" does not exist`);
    }

    // Generate a unique ID for the new project
    const baseName = newName || `${sourceId}-copy`;
    const newId = await this.generateUniqueProjectId(baseName);

    const sourcePath = `${this.dir}/${sourceId}`;
    const destPath = `${this.dir}/${newId}`;

    try {
      // Create the destination directory
      await this.fs.mkdir(destPath, { recursive: true });

      // Copy all files from source to destination (including .git)
      await this.copyDirectory(sourcePath, destPath, false);

      // Get filesystem stats for timestamps
      const stats = await this.fs.stat(destPath);
      const timestamp = stats.mtimeMs ? new Date(stats.mtimeMs) : new Date();

      // Automatically request persistent storage after project duplication
      try {
        await ensurePersistentStorage();
      } catch (error) {
        // Don't fail project duplication if persistent storage request fails
        console.warn('Failed to request persistent storage after project duplication:', error);
      }

      return {
        id: newId,
        name: this.formatProjectName(newId),
        path: destPath,
        lastModified: timestamp,
      };
    } catch (error) {
      // Clean up on error
      try {
        await this.deleteDirectory(destPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up directory after duplication failure:', cleanupError);
      }
      throw error;
    }
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

  /**
   * Safe path join that normalizes the result to prevent directory traversal
   */
  private join(...paths: string[]): string {
    // Simple path joining with normalization
    const joined = paths.join('/').replace(/\/+/g, '/');

    // Normalize path separators and resolve .. and . components
    const parts = joined.split('/').filter(part => part !== '');
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else if (part !== '.') {
        normalized.push(part);
      }
    }

    return '/' + normalized.join('/');
  }

  /**
   * Check if a path is within the project directory
   */
  private isPathWithinProject(extractPath: string, projectPath: string): boolean {
    // Normalize both paths
    const normalizedExtractPath = this.normalize(extractPath);
    const normalizedProjectPath = this.normalize(projectPath);

    // Check if the extract path starts with the project path
    return normalizedExtractPath.startsWith(normalizedProjectPath + '/') ||
           normalizedExtractPath === normalizedProjectPath;
  }

  /**
   * Normalize a path by resolving . and .. components
   */
  private normalize(path: string): string {
    const parts = path.split('/').filter(part => part !== '');
    const normalized: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        normalized.pop();
      } else if (part !== '.') {
        normalized.push(part);
      }
    }

    return '/' + normalized.join('/');
  }
}