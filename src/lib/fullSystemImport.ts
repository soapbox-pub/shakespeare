import JSZip from 'jszip';
import LightningFS from '@isomorphic-git/lightning-fs';
import { LightningFSAdapter } from '@/lib/LightningFSAdapter';
import type { JSRuntimeFS } from '@/lib/JSRuntime';

export interface ImportProgress {
  stage: 'extracting' | 'validating' | 'importing' | 'cleanup' | 'complete';
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
  private tempFSName?: string;

  constructor(onProgress?: (progress: ImportProgress) => void) {
    this.onProgress = onProgress;
  }

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

      // Check for valid structure
      const hasValidStructure = files.some(path =>
        path.startsWith('projects/') ||
        path.startsWith('config/') ||
        path.startsWith('tmp/') ||
        path === 'localStorage.json'
      );

      if (!hasValidStructure) {
        result.errors.push('Invalid export: Missing required structure');
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

      // Check for config
      result.hasConfig = files.some(path =>
        path.startsWith('config/') || path === 'localStorage.json'
      );

      // Security validation
      for (const path of files) {
        if (this.isUnsafePath(path)) {
          result.errors.push(`Unsafe path: ${path}`);
        }
        if (!path.endsWith('/') && !this.isValidFilePath(path) && path !== 'localStorage.json') {
          result.errors.push(`Invalid location: ${path}`);
        }
      }

      result.isValid = result.errors.length === 0;
      return result;

    } catch (error) {
      result.errors.push(`Failed to read ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  async importFullSystem(zipFile: File, currentFS: JSRuntimeFS): Promise<void> {
    try {
      // Extract and validate
      this.reportProgress('extracting', 0, 'Extracting ZIP...');
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      this.reportProgress('validating', 10, 'Validating export...');
      const validation = await this.validateExport(zipFile);

      if (!validation.isValid) {
        throw new Error(`Invalid export: ${validation.errors.slice(0, 2).join(', ')}`);
      }

      // Check if we can use direct import (simpler path)
      const isTestEnvironment = typeof window === 'undefined' || typeof indexedDB === 'undefined';

      if (isTestEnvironment) {
        await this.directImport(zip, currentFS, validation.totalFiles);
      } else {
        await this.tempImport(zip, currentFS, validation.totalFiles);
      }

      // Restore localStorage
      await this.restoreLocalStorage(zip);

      this.reportProgress('complete', 100, 'Import completed!');

    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  private async tempImport(zip: JSZip, currentFS: JSRuntimeFS, totalFiles: number): Promise<void> {
    // Create temporary filesystem
    this.reportProgress('importing', 20, 'Setting up workspace...');
    this.tempFSName = `shakespeare-import-${Date.now()}`;
    const tempLightningFS = new LightningFS(this.tempFSName);
    const tempFS = new LightningFSAdapter(tempLightningFS.promises);

    // Create directories
    await tempFS.mkdir('/projects', { recursive: true });
    await tempFS.mkdir('/config', { recursive: true });
    await tempFS.mkdir('/tmp', { recursive: true });

    // Extract files to temp filesystem
    let filesProcessed = 0;
    const files = Object.entries(zip.files);

    for (const [relativePath, zipEntry] of files) {
      if (this.isUnsafePath(relativePath)) {
        throw new Error(`Unsafe path: ${relativePath}`);
      }

      const fullPath = `/${relativePath}`;

      if (zipEntry.dir) {
        await tempFS.mkdir(fullPath, { recursive: true });
      } else {
        const content = await zipEntry.async('uint8array');
        const dirPath = fullPath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          await tempFS.mkdir(dirPath, { recursive: true });
        }
        await tempFS.writeFile(fullPath, content);
      }

      filesProcessed++;
      const progress = 20 + (filesProcessed / totalFiles) * 60;
      this.reportProgress('importing', progress, `Importing files... (${filesProcessed}/${totalFiles})`);
    }

    // Replace current system
    this.reportProgress('importing', 85, 'Replacing system...');
    await this.replaceSystem(tempFS, currentFS);

    // Cleanup
    this.reportProgress('cleanup', 95, 'Cleaning up...');
    await this.cleanup();
  }

  private async directImport(zip: JSZip, currentFS: JSRuntimeFS, totalFiles: number): Promise<void> {
    this.reportProgress('importing', 30, 'Clearing current system...');
    await this.clearSystem(currentFS);

    let filesProcessed = 0;
    const files = Object.entries(zip.files);

    for (const [relativePath, zipEntry] of files) {
      if (this.isUnsafePath(relativePath)) {
        throw new Error(`Unsafe path: ${relativePath}`);
      }

      const fullPath = `/${relativePath}`;

      if (zipEntry.dir) {
        await currentFS.mkdir(fullPath, { recursive: true });
      } else {
        const content = await zipEntry.async('uint8array');
        const dirPath = fullPath.split('/').slice(0, -1).join('/');
        if (dirPath) {
          await currentFS.mkdir(dirPath, { recursive: true });
        }
        await currentFS.writeFile(fullPath, content);
      }

      filesProcessed++;
      const progress = 30 + (filesProcessed / totalFiles) * 65;
      this.reportProgress('importing', progress, `Importing files... (${filesProcessed}/${totalFiles})`);
    }
  }

  private async replaceSystem(tempFS: JSRuntimeFS, currentFS: JSRuntimeFS): Promise<void> {
    await this.clearSystem(currentFS);
    await this.copyFilesystem(tempFS, currentFS, '/', '/');
  }

  private async clearSystem(fs: JSRuntimeFS): Promise<void> {
    try {
      const entries = await fs.readdir('/', { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `/${entry.name}`;
        if (entry.isDirectory()) {
          await this.deleteDirectory(fs, fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
    } catch (error) {
      console.warn('Failed to clear system:', error);
    }
  }

  private async deleteDirectory(fs: JSRuntimeFS, dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        if (entry.isDirectory()) {
          await this.deleteDirectory(fs, fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
      await fs.rmdir(dirPath);
    } catch (error) {
      console.warn(`Failed to delete ${dirPath}:`, error);
    }
  }

  private async copyFilesystem(sourceFS: JSRuntimeFS, destFS: JSRuntimeFS, sourcePath: string, destPath: string): Promise<void> {
    try {
      const entries = await sourceFS.readdir(sourcePath, { withFileTypes: true });

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
      throw new Error(`Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.tempFSName) {
      try {
        const deleteRequest = indexedDB.deleteDatabase(this.tempFSName);
        await new Promise<void>((resolve, reject) => {
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => resolve();
        });
      } catch (error) {
        console.warn('Cleanup failed:', error);
      }
    }
    this.tempFSName = undefined;
  }

  private async restoreLocalStorage(zip: JSZip): Promise<void> {
    try {
      const localStorageFile = zip.file('localStorage.json');
      if (!localStorageFile) return;

      const localStorageContent = await localStorageFile.async('text');
      const localStorageData = JSON.parse(localStorageContent);

      localStorage.clear();
      for (const [key, value] of Object.entries(localStorageData)) {
        try {
          localStorage.setItem(key, value as string);
        } catch (error) {
          console.warn(`Failed to restore ${key}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to restore localStorage:', error);
    }
  }

  private isUnsafePath(path: string): boolean {
    const normalized = path.replace(/\/+/g, '/');

    // Check for directory traversal patterns
    if (normalized.includes('../') || normalized.includes('..\\')) {
      return true;
    }

    // Check for absolute paths outside allowed structure
    if (normalized.startsWith('/') && !normalized.match(/^\/(projects|config|tmp)\//)) {
      return true;
    }

    return false;
  }

  private isValidFilePath(path: string): boolean {
    const normalized = path.replace(/\/+/g, '/');
    return normalized.startsWith('projects/') ||
           normalized.startsWith('config/') ||
           normalized.startsWith('tmp/');
  }

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

// Convenience functions
export async function importFullSystem(
  zipFile: File,
  currentFS: JSRuntimeFS,
  onProgress?: (progress: ImportProgress) => void
): Promise<void> {
  const importer = new FullSystemImporter(onProgress);
  await importer.importFullSystem(zipFile, currentFS);
}

export async function validateExportFile(zipFile: File): Promise<ImportValidation> {
  const importer = new FullSystemImporter();
  return await importer.validateExport(zipFile);
}