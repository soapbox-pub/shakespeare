import type LightningFS from '@isomorphic-git/lightning-fs';
import { join } from "@std/path/posix/join";
import { dirname } from "@std/path/posix/dirname";
import { relative } from "@std/path/posix/relative";
import { resolve } from "@std/path/posix/resolve";
import { tool } from "ai";
import z from 'zod';

export class FsToolSet {
  constructor(readonly fs: LightningFS.PromisifiedFS, private cwd?: string) {}

  readonly readFile = tool({
    description: 'Read the contents of a file in the project',
    parameters: FsToolSet.readFileSchema,
    execute: async (args) => {
      const filepath = this.resolvePath(args.filePath);
      try {
        const content = await this.fs.readFile(filepath, 'utf8');
        return { content, success: true };
      } catch (error) {
        throw new Error(`Failed to read file ${args.filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly writeFile = tool({
    description: 'Write content to a file in the project',
    parameters: FsToolSet.writeFileSchema,
    execute: async (args) => {
      const filepath = this.resolvePath(args.filePath);
      try {
        // Ensure directory exists
        const dir = dirname(filepath);
        await this.ensureDirectory(dir);
        
        await this.fs.writeFile(filepath, args.content, 'utf8');
        return { success: true, message: `File ${args.filePath} written successfully` };
      } catch (error) {
        throw new Error(`Failed to write file ${args.filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly listDirectory = tool({
    description: 'List contents of a directory',
    parameters: FsToolSet.listDirectorySchema,
    execute: async (args) => {
      const dirpath = this.resolvePath(args.directoryPath || '.');
      try {
        const items = await this.fs.readdir(dirpath);
        const details = await Promise.all(
          items.map(async (item) => {
            const itemPath = join(dirpath, item);
            const stat = await this.fs.stat(itemPath);
            return {
              name: item,
              type: stat.isDirectory() ? 'directory' : 'file',
              size: stat.size,
              modified: stat.mtimeMs,
              path: relative(this.cwd || '/', itemPath),
            };
          })
        );
        return { items: details, success: true };
      } catch (error) {
        throw new Error(`Failed to list directory ${args.directoryPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly createDirectory = tool({
    description: 'Create a directory (and any necessary parent directories)',
    parameters: FsToolSet.createDirectorySchema,
    execute: async (args) => {
      const dirpath = this.resolvePath(args.directoryPath);
      try {
        await this.ensureDirectory(dirpath);
        return { success: true, message: `Directory ${args.directoryPath} created successfully` };
      } catch (error) {
        throw new Error(`Failed to create directory ${args.directoryPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly deleteFile = tool({
    description: 'Delete a file',
    parameters: FsToolSet.deleteFileSchema,
    execute: async (args) => {
      const filepath = this.resolvePath(args.filePath);
      try {
        await this.fs.unlink(filepath);
        return { success: true, message: `File ${args.filePath} deleted successfully` };
      } catch (error) {
        throw new Error(`Failed to delete file ${args.filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly deleteDirectory = tool({
    description: 'Delete a directory and all its contents',
    parameters: FsToolSet.deleteDirectorySchema,
    execute: async (args) => {
      const dirpath = this.resolvePath(args.directoryPath);
      try {
        await this.fs.rmdir(dirpath);
        return { success: true, message: `Directory ${args.directoryPath} deleted successfully` };
      } catch (error) {
        throw new Error(`Failed to delete directory ${args.directoryPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly moveFile = tool({
    description: 'Move or rename a file or directory',
    parameters: FsToolSet.moveFileSchema,
    execute: async (args) => {
      const sourcePath = this.resolvePath(args.sourcePath);
      const destPath = this.resolvePath(args.destinationPath);
      try {
        // Ensure destination directory exists
        const destDir = dirname(destPath);
        await this.ensureDirectory(destDir);
        
        await this.fs.rename(sourcePath, destPath);
        return { success: true, message: `Moved ${args.sourcePath} to ${args.destinationPath}` };
      } catch (error) {
        throw new Error(`Failed to move ${args.sourcePath} to ${args.destinationPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  readonly copyFile = tool({
    description: 'Copy a file from source to destination',
    parameters: FsToolSet.copyFileSchema,
    execute: async (args) => {
      const sourcePath = this.resolvePath(args.sourcePath);
      const destPath = this.resolvePath(args.destinationPath);
      try {
        // Ensure destination directory exists
        const destDir = dirname(destPath);
        await this.ensureDirectory(destDir);
        
        const content = await this.fs.readFile(sourcePath);
        await this.fs.writeFile(destPath, content);
        return { success: true, message: `Copied ${args.sourcePath} to ${args.destinationPath}` };
      } catch (error) {
        throw new Error(`Failed to copy ${args.sourcePath} to ${args.destinationPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  // Helper methods
  private resolvePath(path: string): string {
    if (!this.cwd) return path;
    return resolve(this.cwd, path);
  }

  private async ensureDirectory(dirpath: string): Promise<void> {
    try {
      await this.fs.mkdir(dirpath);
    } catch {
      // Directory might already exist, ignore
    }
  }

  // Schema definitions
  static readFileSchema = z.object({
    filePath: z.string().describe('Path to the file to read'),
  });

  static writeFileSchema = z.object({
    filePath: z.string().describe('Path to the file to write'),
    content: z.string().describe('Content to write to the file'),
  });

  static listDirectorySchema = z.object({
    directoryPath: z.string().optional().describe('Directory path to list (defaults to current directory)'),
  });

  static createDirectorySchema = z.object({
    directoryPath: z.string().describe('Directory path to create'),
  });

  static deleteFileSchema = z.object({
    filePath: z.string().describe('Path to the file to delete'),
  });

  static deleteDirectorySchema = z.object({
    directoryPath: z.string().describe('Path to the directory to delete'),
  });

  static moveFileSchema = z.object({
    sourcePath: z.string().describe('Current path of the file or directory'),
    destinationPath: z.string().describe('New path for the file or directory'),
  });

  static copyFileSchema = z.object({
    sourcePath: z.string().describe('Path to the source file'),
    destinationPath: z.string().describe('Path to the destination file'),
  });

  static fileExistsSchema = z.object({
    path: z.string().describe('Path to check for existence'),
  });

  static getFileInfoSchema = z.object({
    path: z.string().describe('Path to get information about'),
  });

  static readDirectoryRecursiveSchema = z.object({
    directoryPath: z.string().optional().describe('Directory path to start from (defaults to current directory)'),
    maxDepth: z.number().optional().describe('Maximum depth to traverse (optional)'),
  });

  static searchFilesSchema = z.object({
    pattern: z.string().describe('File name pattern to search for (supports * and ? wildcards)'),
    directoryPath: z.string().optional().describe('Directory to search in (defaults to current directory)'),
    maxDepth: z.number().optional().describe('Maximum depth to search (optional)'),
  });
}