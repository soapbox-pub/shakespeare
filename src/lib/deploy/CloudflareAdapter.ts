import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, CloudflareDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface CloudflareProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  production_branch: string;
}

interface CloudflareDeployment {
  id: string;
  url: string;
  environment: string;
  deployment_trigger: {
    type: string;
  };
  latest_stage: {
    name: string;
    status: string;
  };
}

/**
 * Cloudflare Pages Deploy Adapter
 * Uses Cloudflare API with API token
 */
export class CloudflareAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private apiKey: string;
  private accountId: string;
  private baseURL: string;
  private projectName?: string;
  private corsProxy?: string;

  constructor(config: CloudflareDeployConfig) {
    this.fs = config.fs;
    this.apiKey = config.apiKey;
    this.accountId = config.accountId;
    this.baseURL = config.baseURL || 'https://api.cloudflare.com/client/v4';
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

    const activeProjectName = this.projectName || projectId;

    // Get or create project
    let project: CloudflareProject;
    try {
      project = await this.getProject(activeProjectName);
    } catch {
      // Project doesn't exist, create it
      project = await this.createProject(activeProjectName);
    }

    // Create FormData for deployment
    const formData = new FormData();

    // Collect all files from dist directory
    await this.addFilesToFormData(distPath, '', formData);

    // Deploy to Cloudflare Pages
    const deployment = await this.createDeployment(project.name, formData);

    // Construct the production URL
    const productionUrl = `https://${project.subdomain}.pages.dev`;

    return {
      url: productionUrl,
      metadata: {
        deploymentId: deployment.id,
        projectId: project.id,
        projectName: project.name,
        provider: 'cloudflare',
        environment: deployment.environment,
      },
    };
  }

  private async getProject(projectName: string): Promise<CloudflareProject> {
    const url = `${this.baseURL}/accounts/${this.accountId}/pages/projects/${projectName}`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get Cloudflare project: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async createProject(projectName: string): Promise<CloudflareProject> {
    const url = `${this.baseURL}/accounts/${this.accountId}/pages/projects`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        production_branch: 'main',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create Cloudflare project: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async createDeployment(projectName: string, formData: FormData): Promise<CloudflareDeployment> {
    const url = `${this.baseURL}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create Cloudflare deployment: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async addFilesToFormData(
    dirPath: string,
    relativePath: string,
    formData: FormData
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Recursively add files from subdirectories
          await this.addFilesToFormData(fullPath, entryRelativePath, formData);
        } else if (entry.isFile()) {
          try {
            // Read file content
            const fileContent = await this.fs.readFile(fullPath);

            // Convert to Blob for FormData
            let blob: Blob;
            if (typeof fileContent === 'string') {
              blob = new Blob([fileContent], { type: this.getMimeType(entry.name) });
            } else {
              // Handle Uint8Array
              blob = new Blob([fileContent], { type: this.getMimeType(entry.name) });
            }

            // Add to FormData with the relative path as the field name
            formData.append(entryRelativePath, blob, entry.name);
          } catch (error) {
            console.warn(`Failed to read file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
