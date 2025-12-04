import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, DenoDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface Deployment {
  id: string;
  projectId: string;
  status: string;
  domains: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Deno Deploy Adapter
 * Uses Deno Deploy API to deploy static sites
 *
 * Implements the Deno Deploy workflow:
 * 1. Create or find existing project
 * 2. Build asset manifest with file contents
 * 3. Create deployment with assets
 * 4. Attach domain to deployment
 */
export class DenoDeployAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private apiKey: string;
  private organizationId: string;
  private baseURL: string;
  private projectName?: string;
  private corsProxy?: string;

  constructor(config: DenoDeployConfig) {
    this.fs = config.fs;
    this.apiKey = config.apiKey;
    this.organizationId = config.organizationId;
    this.baseURL = config.baseURL || 'https://api.deno.com/v1';
    this.projectName = config.projectName;
    this.corsProxy = config.corsProxy;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectId, projectPath } = options;

    // Check if dist directory exists and contains index.html
    const distPath = `${projectPath}/dist`;
    try {
      await this.fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    const projectName = this.projectName || projectId;

    // Step 1: Get or create project
    const project = await this.getOrCreateProject(projectName);

    // Step 2: Collect all files and build assets
    const assets: Record<string, { kind: string; content: string; encoding: string }> = {};
    await this.collectFiles(distPath, '', assets);

    // Step 3: Create deployment with assets
    const deployment = await this.createDeployment(project.id, assets);

    // Step 4: Attach the deno.dev domain to the deployment
    const domain = `${project.name}.deno.dev`;
    await this.attachDomain(deployment.id, `{project.name}.deno.dev`);

    return {
      url: `https://${domain}`,
      metadata: {
        deploymentId: deployment.id,
        projectId: project.id,
        projectName: project.name,
        provider: 'deno-deploy',
        status: deployment.status,
      },
    };
  }

  private async getOrCreateProject(projectName: string): Promise<Project> {
    // First, try to find existing project
    const existingProject = await this.findProject(projectName);
    if (existingProject) {
      return existingProject;
    }

    // Create new project
    return this.createProject(projectName);
  }

  private async findProject(projectName: string): Promise<Project | null> {
    const url = `${this.baseURL}/organizations/${this.organizationId}/projects?q=${encodeURIComponent(projectName)}`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      // If we can't list projects, just return null and try to create
      return null;
    }

    const projects: Project[] = await response.json();
    return projects.find(p => p.name === projectName) || null;
  }

  private async createProject(projectName: string): Promise<Project> {
    const url = `${this.baseURL}/organizations/${this.organizationId}/projects`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create project: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async createDeployment(
    projectId: string,
    assets: Record<string, { kind: string; content: string; encoding: string }>
  ): Promise<Deployment> {
    const url = `${this.baseURL}/projects/${projectId}/deployments`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    // Create a minimal server script that serves static files
    // For static sites, we use a simple file server entry point
    const entryPointUrl = 'file:///src/main.ts';

    // Add the entry point script that serves static files
    const serverScript = `
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";

Deno.serve((req) => {
  return serveDir(req, {
    fsRoot: ".",
    showIndex: true,
    enableCors: true,
  });
});
`;

    // Add the server script to assets
    assets['src/main.ts'] = {
      kind: 'file',
      content: serverScript,
      encoding: 'utf-8',
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entryPointUrl,
        assets,
        importMapUrl: null,
        lockFileUrl: null,
        compilerOptions: null,
        envVars: {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create deployment: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async attachDomain(deploymentId: string, domain: string): Promise<void> {
    const url = `${this.baseURL}/deployments/${deploymentId}/domains/${encodeURIComponent(domain)}`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // Don't throw on domain attachment failure - deployment still succeeded
      console.warn(`Failed to attach domain: ${response.status} ${response.statusText}. ${errorText}`);
    }
  }

  private async collectFiles(
    dirPath: string,
    relativePath: string,
    assets: Record<string, { kind: string; content: string; encoding: string }>
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.collectFiles(fullPath, entryRelativePath, assets);
        } else if (entry.isFile()) {
          try {
            const fileContent = await this.fs.readFile(fullPath);

            // Determine if file is text or binary based on extension
            const isText = this.isTextFile(entry.name);

            let content: string;
            let encoding: 'utf-8' | 'base64';

            if (isText) {
              if (typeof fileContent === 'string') {
                content = fileContent;
              } else {
                content = new TextDecoder().decode(fileContent);
              }
              encoding = 'utf-8';
            } else {
              // Binary file - encode as base64
              let bytes: Uint8Array;
              if (typeof fileContent === 'string') {
                bytes = new TextEncoder().encode(fileContent);
              } else {
                bytes = fileContent;
              }
              content = this.uint8ArrayToBase64(bytes);
              encoding = 'base64';
            }

            assets[entryRelativePath] = {
              kind: 'file',
              content,
              encoding,
            };
          } catch (error) {
            console.warn(`Failed to read file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }

  private isTextFile(filename: string): boolean {
    const textExtensions = [
      'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
      'json', 'xml', 'svg', 'txt', 'md', 'yaml', 'yml', 'toml',
      'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
      'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp',
      'rs', 'go', 'swift', 'kt', 'scala', 'clj', 'ex', 'exs',
      'vue', 'svelte', 'astro', 'njk', 'ejs', 'pug', 'hbs',
      'graphql', 'gql', 'sql', 'csv', 'tsv', 'log', 'ini', 'cfg',
      'env', 'gitignore', 'dockerignore', 'editorconfig',
      'prettierrc', 'eslintrc', 'babelrc', 'npmrc',
      'map', // source maps
    ];

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    // Also check if filename itself is a known text file
    const textFilenames = [
      'dockerfile', 'makefile', 'gemfile', 'rakefile', 'procfile',
      'license', 'readme', 'changelog', 'authors', 'contributors',
    ];

    return textExtensions.includes(ext) || textFilenames.includes(filename.toLowerCase());
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
