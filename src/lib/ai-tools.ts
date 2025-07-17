import { fsManager } from './fs';

// Context-aware AI tools that automatically use the current project ID
class ContextualAITools {
  private currentProjectId: string | null = null;

  setCurrentProjectId(projectId: string) {
    this.currentProjectId = projectId;
  }

  getCurrentProjectId(): string {
    if (!this.currentProjectId) {
      throw new Error('No project context set. Please ensure you are in a project view.');
    }
    return this.currentProjectId;
  }

  async readFile(filePath: string): Promise<string> {
    const projectId = this.getCurrentProjectId();
    return await fsManager.readFile(projectId, filePath);
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean; message: string }> {
    const projectId = this.getCurrentProjectId();
    await fsManager.writeFile(projectId, filePath, content);
    return { success: true, message: `File ${filePath} written successfully` };
  }

  async deleteFile(filePath: string): Promise<{ success: boolean; message: string }> {
    const projectId = this.getCurrentProjectId();
    await fsManager.deleteFile(projectId, filePath);
    return { success: true, message: `File ${filePath} deleted successfully` };
  }

  async listFiles(dirPath: string = ''): Promise<string[]> {
    const projectId = this.getCurrentProjectId();
    return await fsManager.listFiles(projectId, dirPath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    const projectId = this.getCurrentProjectId();
    return await fsManager.fileExists(projectId, filePath);
  }

  async buildProject(): Promise<{ success: boolean; message: string; url: string }> {
    const projectId = this.getCurrentProjectId();
    // TODO: Implement Vite build in browser
    return {
      success: true,
      message: 'Build started (stub implementation)',
      url: `/preview/${projectId}`
    };
  }

  async getProjectStructure(): Promise<Record<string, unknown>> {
    const projectId = this.getCurrentProjectId();
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

  async searchFiles(query: string): Promise<Array<{path: string, content: string}>> {
    const projectId = this.getCurrentProjectId();
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

// Create a singleton instance
export const contextualAITools = new ContextualAITools();

// Backward compatibility: export the old interface for existing code
interface LegacyOperation {
  type: string;
  projectId?: string;
  filePath?: string;
  content?: string;
  query?: string;
}

export class AITools {
  async executeOperation(operation: LegacyOperation): Promise<unknown> {
    try {
      switch (operation.type) {
        case 'read':
          if (!operation.filePath) throw new Error('filePath is required');
          return await contextualAITools.readFile(operation.filePath);

        case 'write':
          if (!operation.filePath) throw new Error('filePath is required');
          if (!operation.content) {
            throw new Error('Content is required for write operations');
          }
          return await contextualAITools.writeFile(operation.filePath, operation.content);

        case 'delete':
          if (!operation.filePath) throw new Error('filePath is required');
          return await contextualAITools.deleteFile(operation.filePath);

        case 'list':
          return await contextualAITools.listFiles(operation.filePath);

        case 'exists':
          if (!operation.filePath) throw new Error('filePath is required');
          return await contextualAITools.fileExists(operation.filePath);

        case 'build':
          return await contextualAITools.buildProject();

        case 'getProjectStructure':
          return await contextualAITools.getProjectStructure();

        case 'searchFiles':
          if (!operation.query) throw new Error('query is required');
          return await contextualAITools.searchFiles(operation.query);

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      return { error: error.message };
    }
  }
}

export const aiTools = new AITools();