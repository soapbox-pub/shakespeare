import { fsManager } from './fs';

export interface FileOperation {
  type: 'read' | 'write' | 'delete' | 'list' | 'exists';
  projectId: string;
  filePath: string;
  content?: string;
}

export interface BuildOperation {
  type: 'build';
  projectId: string;
}

export type AIToolOperation = FileOperation | BuildOperation;

export class AITools {
  async executeOperation(operation: AIToolOperation): Promise<unknown> {
    try {
      switch (operation.type) {
        case 'read':
          return await this.readFile(operation.projectId, operation.filePath);

        case 'write':
          if (!operation.content) {
            throw new Error('Content is required for write operations');
          }
          await this.writeFile(operation.projectId, operation.filePath, operation.content);
          return { success: true, message: 'File written successfully' };

        case 'delete':
          await this.deleteFile(operation.projectId, operation.filePath);
          return { success: true, message: 'File deleted successfully' };

        case 'list':
          return await this.listFiles(operation.projectId, operation.filePath);

        case 'exists':
          return await this.fileExists(operation.projectId, operation.filePath);

        case 'build':
          return await this.buildProject(operation.projectId);

        default:
          throw new Error(`Unknown operation type: ${(operation as { type: string }).type}`);
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  private async readFile(projectId: string, filePath: string): Promise<string> {
    return await fsManager.readFile(projectId, filePath);
  }

  private async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    await fsManager.writeFile(projectId, filePath, content);
  }

  private async deleteFile(projectId: string, filePath: string): Promise<void> {
    await fsManager.deleteFile(projectId, filePath);
  }

  private async listFiles(projectId: string, dirPath: string = ''): Promise<string[]> {
    return await fsManager.listFiles(projectId, dirPath);
  }

  private async fileExists(projectId: string, filePath: string): Promise<boolean> {
    return await fsManager.fileExists(projectId, filePath);
  }

  private async buildProject(projectId: string): Promise<{ success: boolean; message: string; url: string }> {
    // TODO: Implement Vite build in browser
    // For now, return a stub
    return {
      success: true,
      message: 'Build started (stub implementation)',
      url: `/preview/${projectId}`
    };
  }

  async getProjectStructure(projectId: string): Promise<Record<string, unknown>> {
    const structure: Record<string, unknown> = {};

    async function buildStructure(currentPath: string, obj: Record<string, unknown>) {
      const items = await fsManager.listFiles(projectId, currentPath);

      for (const item of items) {
        const itemPath = currentPath ? `${currentPath}/${item}` : item;
        const fullPath = `${fsManager['dir']}/${projectId}/${itemPath}`;

        try {
          const stat = await fsManager['fs'].promises.stat(fullPath);
          if (stat.isDirectory()) {
            const newObj: Record<string, unknown> = {};
            obj[item] = newObj;
            await buildStructure(itemPath, newObj);
          } else {
            obj[item] = 'file';
          }
        } catch {
          // Skip inaccessible items
        }
      }
    }

    await buildStructure('', structure);
    return structure;
  }

  async searchFiles(projectId: string, query: string): Promise<Array<{path: string, content: string}>> {
    const results: Array<{path: string, content: string}> = [];

    async function searchDirectory(dirPath: string) {
      const items = await fsManager.listFiles(projectId, dirPath);

      for (const item of items) {
        const itemPath = dirPath ? `${dirPath}/${item}` : item;
        const fullPath = `${fsManager['dir']}/${projectId}/${itemPath}`;

        try {
          const stat = await fsManager['fs'].promises.stat(fullPath);
          if (stat.isDirectory()) {
            await searchDirectory(itemPath);
          } else {
            const content = await fsManager.readFile(projectId, itemPath);
            if (content.toLowerCase().includes(query.toLowerCase())) {
              results.push({ path: itemPath, content });
            }
          }
        } catch {
          // Skip inaccessible files
        }
      }
    }

    await searchDirectory('');
    return results;
  }
}

export const aiTools = new AITools();