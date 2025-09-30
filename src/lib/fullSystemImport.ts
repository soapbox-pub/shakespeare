import JSZip from 'jszip';
import LightningFS from '@isomorphic-git/lightning-fs';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

export interface ImportProgress {
  stage: 'extracting' | 'validating' | 'creating_temp' | 'importing' | 'replacing' | 'cleanup' | 'complete';
  progress: number;
  message: string;
  filesProcessed?: number;
  totalFiles?: number;
}

export interface ImportValidation {
  isValid: boolean;
  hasProjects: boolean;
  hasConfig: boolean;
  projectCount: number;
  totalFiles: number;
  errors: string[];
  warnings: string[];
}

export class FullSystemImporter {
  private onProgress?: (progress: ImportProgress) => void;
  private tempFS?: JSRuntimeFS;
  private tempFSName?: string;

  constructor(onProgress?: (progress: ImportProgress) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Validate a ZIP file to ensure it's a valid Shakespeare export
   */
  async validateExport(zipFile: File): Promise<ImportValidation> {
    const result: ImportValidation = {
      isValid: false,
      hasProjects: false,
      hasConfig: false,
      projectCount: 0,
      totalFiles: 0,
      errors: [],
      warnings: []
    };

    try {
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const files = Object.keys(zip.files);
      result.totalFiles = files.length;

      // Check for required directory structure or localStorage data
      const hasRootStructure = files.some(path =>
        path.startsWith('projects/') ||
        path.startsWith('config/') ||
        path.startsWith('tmp/') ||
        path === 'projects' ||
        path === 'config' ||
        path === 'tmp'
      );

      const hasLocalStorageData = files.includes('localStorage.json');

      if (!hasRootStructure && !hasLocalStorageData) {
        result.errors.push('Invalid export format: Missing required directory structure and localStorage data');
        return result;
      }

      // Count projects
      const projectDirs = new Set<string>();
      files.forEach(path => {
        if (path.startsWith('projects/')) {
          const parts = path.split('/');
          if (parts.length >= 2 && parts[1]) {
            projectDirs.add(parts[1]);
          }
        }
      });

      result.projectCount = projectDirs.size;
      result.hasProjects = result.projectCount > 0;

      // Check for config files
      result.hasConfig = files.some(path =>
        path.startsWith('config/ai.json') ||
        path.startsWith('config/git.json')
      ) || hasLocalStorageData;

      // Validate file paths for security
      for (const path of files) {
        if (this.isUnsafePath(path)) {
          result.errors.push(`Unsafe file path detected: ${path}`);
        }

        // Check if file is in valid directory structure
        if (!path.endsWith('/') && !this.isValidFilePath(path)) {
          result.errors.push(`File in invalid location: ${path}`);
        }
      }

      // Add warnings for missing components
      if (!result.hasProjects) {
        result.warnings.push('No projects found in export');
      }
      if (!result.hasConfig) {
        result.warnings.push('No configuration files found in export');
      }

      result.isValid = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(`Failed to read ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Import a complete Shakespeare export, replacing the current system
   */
  async importFullSystem(zipFile: File, currentFS: JSRuntimeFS): Promise<void> {
    try {
      // Stage 1: Extract and validate
      this.reportProgress('extracting', 0, 'Extracting ZIP file...');
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      this.reportProgress('validating', 10, 'Validating export...');
      const validation = await this.validateExport(zipFile);

      if (!validation.isValid) {
        throw new Error(`Invalid export file: ${validation.errors.join(', ')}`);
      }

      // For test environments or when IndexedDB is not available, use direct import
      const isTestEnvironment = typeof window === 'undefined' || typeof indexedDB === 'undefined';

      if (isTestEnvironment) {
        // Direct import without temporary filesystem
        this.reportProgress('replacing', 30, 'Replacing current system...');
        await this.directImport(zip, currentFS, validation.totalFiles);
        this.reportProgress('replacing', 90, 'Restoring settings and preferences...');
        await this.restoreLocalStorage(zip);
        this.reportProgress('complete', 100, 'Import completed successfully!');
        return;
      }

      // Stage 2: Create temporary filesystem
      this.reportProgress('creating_temp', 20, 'Creating temporary import workspace...');
      await this.createTempFilesystem();

      if (!this.tempFS) {
        throw new Error('Failed to create temporary filesystem');
      }

      // Stage 3: Import to temporary filesystem
      this.reportProgress('importing', 30, 'Importing files to temporary workspace...');
      await this.importToTempFilesystem(zip, validation.totalFiles);

      // Stage 4: Validate imported data
      this.reportProgress('validating', 70, 'Validating imported data...');
      await this.validateImportedData();

      // Stage 5: Replace current system
      this.reportProgress('replacing', 80, 'Replacing current system...');
      await this.replaceCurrentSystem(currentFS);

      // Stage 6: Restore localStorage
      this.reportProgress('replacing', 90, 'Restoring settings and preferences...');
      await this.restoreLocalStorage(zip);

      // Stage 7: Cleanup
      this.reportProgress('cleanup', 95, 'Cleaning up temporary files...');
      await this.cleanupTempFilesystem();

      this.reportProgress('complete', 100, 'Import completed successfully!');

    } catch (error) {
      // Cleanup on error
      await this.cleanupTempFilesystem();
      throw error;
    }
  }

  /**
   * Create a temporary filesystem for import processing
   */
  private async createTempFilesystem(): Promise<void> {
    this.tempFSName = `shakespeare-import-${Date.now()}`;
    const tempLightningFS = new LightningFS(this.tempFSName);
    this.tempFS = new LightningFSAdapter(tempLightningFS.promises);

    // Create basic directory structure
    await this.tempFS.mkdir('/projects', { recursive: true });
    await this.tempFS.mkdir('/config', { recursive: true });
    await this.tempFS.mkdir('/tmp', { recursive: true });
  }

  /**
   * Import ZIP contents to temporary filesystem
   */
  private async importToTempFilesystem(zip: JSZip, totalFiles: number): Promise<void> {
    if (!this.tempFS) {
      throw new Error('Temporary filesystem not initialized');
    }

    let filesProcessed = 0;
    const files = Object.entries(zip.files);

    for (const [relativePath, zipEntry] of files) {
      // Validate path security
      if (this.isUnsafePath(relativePath)) {
        throw new Error(`Unsafe file path: ${relativePath}`);
      }

      const fullPath = `/${relativePath}`;

      if (zipEntry.dir) {
        // Create directory
        await this.tempFS.mkdir(fullPath, { recursive: true });
      } else {
        // Extract file
        const content = await zipEntry.async('uint8array');

        // Ensure parent directory exists
        const dirPath = fullPath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          await this.tempFS.mkdir(dirPath, { recursive: true });
        }

        // Write file
        await this.tempFS.writeFile(fullPath, content);
      }

      filesProcessed++;
      const progress = 30 + (filesProcessed / totalFiles) * 40; // 30-70% range
      this.reportProgress('importing', progress, `Importing files... (${filesProcessed}/${totalFiles})`, filesProcessed, totalFiles);
    }
  }

  /**
   * Validate the imported data in temporary filesystem
   */
  private async validateImportedData(): Promise<void> {
    if (!this.tempFS) {
      throw new Error('Temporary filesystem not initialized');
    }

    try {
      // Check that core directories exist
      await this.tempFS.stat('/projects');
      await this.tempFS.stat('/config');
      await this.tempFS.stat('/tmp');

      // Validate project structure
      const projects = await this.tempFS.readdir('/projects');
      for (const projectId of projects) {
        const projectPath = `/projects/${projectId}`;
        const projectStat = await this.tempFS.stat(projectPath);

        if (!projectStat.isDirectory()) {
          throw new Error(`Invalid project structure: ${projectId} is not a directory`);
        }

        // Check for essential project files (package.json is common)
        try {
          await this.tempFS.stat(`${projectPath}/package.json`);
        } catch {
          // package.json is not required, but log if missing
          console.warn(`Project ${projectId} does not have package.json`);
        }
      }

    } catch (error) {
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Replace the current filesystem with the imported data
   */
  private async replaceCurrentSystem(currentFS: JSRuntimeFS): Promise<void> {
    if (!this.tempFS) {
      throw new Error('Temporary filesystem not initialized');
    }

    // Step 1: Clear current system
    await this.clearCurrentSystem(currentFS);

    // Step 2: Copy from temporary filesystem to current filesystem
    await this.copyFilesystem(this.tempFS, currentFS, '/', '/');
  }

  /**
   * Clear the current filesystem completely
   */
  private async clearCurrentSystem(fs: JSRuntimeFS): Promise<void> {
    try {
      // Get all top-level directories
      const entries = await fs.readdir('/', { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `/${entry.name}`;

        if (entry.isDirectory()) {
          await this.deleteDirectoryRecursive(fs, fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
    } catch (error) {
      // If readdir fails, the filesystem might be empty or corrupted
      console.warn('Failed to clear current system:', error);
    }
  }

  /**
   * Recursively delete a directory and all its contents
   */
  private async deleteDirectoryRecursive(fs: JSRuntimeFS, dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.isDirectory()) {
          await this.deleteDirectoryRecursive(fs, fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }

      await fs.rmdir(dirPath);
    } catch (error) {
      console.warn(`Failed to delete directory ${dirPath}:`, error);
    }
  }

  /**
   * Copy entire filesystem from source to destination
   */
  private async copyFilesystem(sourceFS: JSRuntimeFS, destFS: JSRuntimeFS, sourcePath: string, destPath: string): Promise<void> {
    try {
      const entries = await sourceFS.readdir(sourcePath, { withFileTypes: true });

      // Ensure destination directory exists
      if (destPath !== '/') {
        await destFS.mkdir(destPath, { recursive: true });
      }

      for (const entry of entries) {
        const sourceFilePath = sourcePath === '/' ? `/${entry.name}` : `${sourcePath}/${entry.name}`;
        const destFilePath = destPath === '/' ? `/${entry.name}` : `${destPath}/${entry.name}`;

        if (entry.isDirectory()) {
          await destFS.mkdir(destFilePath, { recursive: true });
          await this.copyFilesystem(sourceFS, destFS, sourceFilePath, destFilePath);
        } else {
          const content = await sourceFS.readFile(sourceFilePath);
          await destFS.writeFile(destFilePath, content);
        }
      }
    } catch (error) {
      throw new Error(`Failed to copy filesystem: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up temporary filesystem
   */
  private async cleanupTempFilesystem(): Promise<void> {
    if (this.tempFSName) {
      try {
        // Delete the temporary IndexedDB database
        const deleteRequest = indexedDB.deleteDatabase(this.tempFSName);

        await new Promise<void>((resolve, reject) => {
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            console.warn('Temporary database deletion blocked');
            resolve(); // Continue anyway
          };
        });
      } catch (error) {
        console.warn('Failed to cleanup temporary filesystem:', error);
      }
    }

    this.tempFS = undefined;
    this.tempFSName = undefined;
  }

  /**
   * Check if a file path is unsafe (contains directory traversal)
   */
  private isUnsafePath(path: string): boolean {
    // Normalize path and check for directory traversal
    const normalized = path.replace(/\/+/g, '/');

    // Check for directory traversal patterns
    if (normalized.includes('../') || normalized.includes('..\\')) {
      return true;
    }

    // Check for absolute paths outside of allowed structure
    if (normalized.startsWith('/') && !normalized.match(/^\/(projects|config|tmp)\//)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a file path is in a valid directory structure
   */
  private isValidFilePath(path: string): boolean {
    // Normalize path
    const normalized = path.replace(/\/+/g, '/');

    // Allow localStorage.json at root level
    if (normalized === 'localStorage.json') {
      return true;
    }

    // Check if file is in allowed directories
    return normalized.startsWith('projects/') ||
           normalized.startsWith('config/') ||
           normalized.startsWith('tmp/');
  }

  /**
   * Direct import without temporary filesystem (for tests and simple cases)
   */
  private async directImport(zip: JSZip, currentFS: JSRuntimeFS, totalFiles: number): Promise<void> {
    // Clear current system
    await this.clearCurrentSystem(currentFS);

    let filesProcessed = 0;
    const files = Object.entries(zip.files);

    for (const [relativePath, zipEntry] of files) {
      // Validate path security
      if (this.isUnsafePath(relativePath)) {
        throw new Error(`Unsafe file path: ${relativePath}`);
      }

      const fullPath = `/${relativePath}`;

      if (zipEntry.dir) {
        // Create directory
        await currentFS.mkdir(fullPath, { recursive: true });
      } else {
        // Extract file
        const content = await zipEntry.async('uint8array');

        // Ensure parent directory exists
        const dirPath = fullPath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          await currentFS.mkdir(dirPath, { recursive: true });
        }

        // Write file
        await currentFS.writeFile(fullPath, content);
      }

      filesProcessed++;
      const progress = 30 + (filesProcessed / totalFiles) * 65; // 30-95% range
      this.reportProgress('replacing', progress, `Importing files... (${filesProcessed}/${totalFiles})`, filesProcessed, totalFiles);
    }
  }

  /**
   * Restore localStorage data from the ZIP
   */
  private async restoreLocalStorage(zip: JSZip): Promise<void> {
    try {
      const localStorageFile = zip.file('localStorage.json');
      if (!localStorageFile) {
        // No localStorage data in export, skip restoration
        return;
      }

      const localStorageContent = await localStorageFile.async('text');
      const localStorageData = JSON.parse(localStorageContent) as Record<string, string>;

      // Clear current localStorage
      localStorage.clear();

      // Restore localStorage data
      for (const [key, value] of Object.entries(localStorageData)) {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.warn(`Failed to restore localStorage key "${key}":`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to restore localStorage data:', error);
      // Don't fail the entire import if localStorage restoration fails
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(stage: ImportProgress['stage'], progress: number, message: string, filesProcessed?: number, totalFiles?: number): void {
    if (this.onProgress) {
      this.onProgress({
        stage,
        progress: Math.min(100, Math.max(0, progress)),
        message,
        filesProcessed,
        totalFiles
      });
    }
  }
}

/**
 * Convenience function to import a full system
 */
export async function importFullSystem(
  zipFile: File,
  currentFS: JSRuntimeFS,
  onProgress?: (progress: ImportProgress) => void
): Promise<void> {
  const importer = new FullSystemImporter(onProgress);
  await importer.importFullSystem(zipFile, currentFS);
}

/**
 * Convenience function to validate an export file
 */
export async function validateExportFile(zipFile: File): Promise<ImportValidation> {
  const importer = new FullSystemImporter();
  return await importer.validateExport(zipFile);
}