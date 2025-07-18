import LightningFS from '@isomorphic-git/lightning-fs';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { Buffer } from 'buffer';

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

export class FileSystemManager {
  fs: LightningFS;
  dir: string;

  constructor() {
    this.fs = new LightningFS('shakespeare-fs');
    this.dir = '/projects';
  }

  async init() {
    try {
      await this.fs.promises.mkdir(this.dir);
    } catch {
      // Directory might already exist
    }
  }

  async createProject(name: string): Promise<Project> {
    const id = this.generateProjectId(name);
    const projectPath = `${this.dir}/${id}`;

    await this.fs.promises.mkdir(projectPath);

    const project: Project = {
      id,
      name,
      path: projectPath,
      createdAt: new Date(),
      lastModified: new Date(),
    };

    // Save project metadata
    await this.fs.promises.writeFile(
      `${projectPath}/.project.json`,
      JSON.stringify(project, null, 2)
    );

    // Clone the template
    await this.cloneTemplate(projectPath);

    return project;
  }

  async cloneTemplate(projectPath: string) {
    try {
      await git.clone({
        fs: this.fs,
        http,
        dir: projectPath,
        url: GIT_TEMPLATE_URL,
        singleBranch: true,
        depth: 1,
      });
    } catch {
      // Create basic structure if clone fails
      await this.createBasicStructure(projectPath);
    }
  }

  async createBasicStructure(projectPath: string) {
    const files = {
      'package.json': JSON.stringify({
        name: 'shakespeare-project',
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.0.0',
          vite: '^4.4.0'
        }
      }, null, 2),
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Shakespeare Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
      'src/App.jsx': `import React from 'react'

function App() {
  return (
    <div className="App">
      <h1>Welcome to your Shakespeare project!</h1>
      <p>This is a basic React app template.</p>
    </div>
  )
}

export default App`,
      'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`
    };

    for (const [filename, content] of Object.entries(files)) {
      const filePath = `${projectPath}/${filename}`;
      const dir = filePath.split('/').slice(0, -1).join('/');
      try {
        await this.fs.promises.mkdir(dir);
      } catch {
        // Directory might already exist
      }
      await this.fs.promises.writeFile(filePath, content);
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      const projectDirs = await this.fs.promises.readdir(this.dir);
      const projects: Project[] = [];

      for (const dir of projectDirs) {
        const projectPath = `${this.dir}/${dir}`;
        const projectFile = `${projectPath}/.project.json`;

        try {
          const projectData = await this.fs.promises.readFile(projectFile, 'utf8');
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
      const projectData = await this.fs.promises.readFile(projectFile, 'utf8');
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
      return await this.fs.promises.readFile(fullPath, 'utf8');
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
    await this.fs.promises.mkdir(dir);
    await this.fs.promises.writeFile(fullPath, content);

    // Update last modified
    await this.updateProjectLastModified(projectId);
  }

  async deleteFile(projectId: string, filePath: string): Promise<void> {
    const fullPath = `${this.dir}/${projectId}/${filePath}`;
    await this.fs.promises.unlink(fullPath);
    await this.updateProjectLastModified(projectId);
  }

  async listFiles(projectId: string, dirPath: string = ''): Promise<string[]> {
    const fullPath = `${this.dir}/${projectId}/${dirPath}`;
    try {
      return await this.fs.promises.readdir(fullPath);
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
      await this.fs.promises.stat(fullPath);
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
      const projectData = await this.fs.promises.readFile(projectFile, 'utf8');
      const project = JSON.parse(projectData);
      project.lastModified = new Date().toISOString();
      await this.fs.promises.writeFile(projectFile, JSON.stringify(project, null, 2));
    } catch {
      // Ignore errors updating last modified
    }
  }
}

export const fsManager = new FileSystemManager();