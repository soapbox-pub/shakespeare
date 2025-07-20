import { ProjectsManager } from './fs';

// Context-aware AI tools that automatically use the current project ID
class ContextualAITools {
  private currentProjectId: string | null = null;
  private projectsManager: ProjectsManager;

  constructor(projectsManager: ProjectsManager) {
    this.projectsManager = projectsManager;
  }

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
    try {
      return await this.projectsManager.readFile(projectId, filePath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      throw new Error(`Failed to read file "${filePath}": ${fsError.message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean; message: string }> {
    const projectId = this.getCurrentProjectId();
    try {
      await this.projectsManager.writeFile(projectId, filePath, content);
      return { success: true, message: `File ${filePath} written successfully` };
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      throw new Error(`Failed to write file "${filePath}": ${fsError.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<{ success: boolean; message: string }> {
    const projectId = this.getCurrentProjectId();
    try {
      await this.projectsManager.deleteFile(projectId, filePath);
      return { success: true, message: `File ${filePath} deleted successfully` };
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      throw new Error(`Failed to delete file "${filePath}": ${fsError.message}`);
    }
  }

  async listFiles(dirPath: string = ''): Promise<string[]> {
    const projectId = this.getCurrentProjectId();
    try {
      return await this.projectsManager.listFiles(projectId, dirPath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      throw new Error(`Failed to list files in "${dirPath}": ${fsError.message}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    const projectId = this.getCurrentProjectId();
    try {
      return await this.projectsManager.fileExists(projectId, filePath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      throw new Error(`Failed to check if file exists "${filePath}": ${fsError.message}`);
    }
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

    const buildStructure = async (currentPath: string, obj: Record<string, unknown>) => {
      const items = await this.projectsManager.listFiles(projectId, currentPath);

      for (const item of items) {
        const itemPath = currentPath ? `${currentPath}/${item}` : item;
        const fullPath = `${this.projectsManager['dir']}/${projectId}/${itemPath}`;

        try {
          const stat = await this.projectsManager['fs'].stat(fullPath);
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
    };

    await buildStructure('', structure);
    return structure;
  }

  async searchFiles(query: string): Promise<Array<{path: string, content: string}>> {
    const projectId = this.getCurrentProjectId();
    const results: Array<{path: string, content: string}> = [];

    const searchDirectory = async (dirPath: string) => {
      const items = await this.projectsManager.listFiles(projectId, dirPath);

      for (const item of items) {
        const itemPath = dirPath ? `${dirPath}/${item}` : item;
        const fullPath = `${this.projectsManager['dir']}/${projectId}/${itemPath}`;

        try {
          const stat = await this.projectsManager['fs'].stat(fullPath);
          if (stat.isDirectory()) {
            await searchDirectory(itemPath);
          } else {
            const content = await this.projectsManager.readFile(projectId, itemPath);
            if (content.toLowerCase().includes(query.toLowerCase())) {
              results.push({ path: itemPath, content });
            }
          }
        } catch {
          // Skip inaccessible files
        }
      }
    };

    await searchDirectory('');
    return results;
  }
}

// Factory function to create ContextualAITools with ProjectsManager
export function createContextualAITools(projectsManager: ProjectsManager): ContextualAITools {
  return new ContextualAITools(projectsManager);
}

// Backward compatibility: export the old interface for existing code
interface LegacyOperation {
  type: string;
  projectId?: string;
  filePath?: string;
  content?: string;
  query?: string;
}

export class AITools {
  private contextualAITools: ContextualAITools;

  constructor(projectsManager: ProjectsManager) {
    this.contextualAITools = new ContextualAITools(projectsManager);
  }

  async executeOperation(operation: LegacyOperation): Promise<unknown> {
    try {
      switch (operation.type) {
        case 'read':
          if (!operation.filePath) throw new Error('filePath is required');
          return await this.contextualAITools.readFile(operation.filePath);

        case 'write':
          if (!operation.filePath) throw new Error('filePath is required');
          if (!operation.content) {
            throw new Error('Content is required for write operations');
          }
          return await this.contextualAITools.writeFile(operation.filePath, operation.content);

        case 'delete':
          if (!operation.filePath) throw new Error('filePath is required');
          return await this.contextualAITools.deleteFile(operation.filePath);

        case 'list':
          return await this.contextualAITools.listFiles(operation.filePath);

        case 'exists':
          if (!operation.filePath) throw new Error('filePath is required');
          return await this.contextualAITools.fileExists(operation.filePath);

        case 'build':
          return await this.contextualAITools.buildProject();

        case 'getProjectStructure':
          return await this.contextualAITools.getProjectStructure();

        case 'searchFiles':
          if (!operation.query) throw new Error('query is required');
          return await this.contextualAITools.searchFiles(operation.query);

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Factory function to create AITools with ProjectsManager
export function createAITools(projectsManager: ProjectsManager): AITools {
  return new AITools(projectsManager);
}