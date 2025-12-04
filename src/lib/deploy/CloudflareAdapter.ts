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

    // Collect all files and create manifest
    const files: Record<string, string> = {};
    const fileContents: Record<string, Uint8Array> = {};
    await this.collectFiles(distPath, '', files, fileContents);

    // Deploy to Cloudflare Pages using Direct Upload
    const deployment = await this.createDeployment(project.name, files, fileContents);

    // Construct the production URL
    // The subdomain from the API response already includes the full domain
    // e.g., "error-button.pages.dev" not just "error-button"
    const productionUrl = project.subdomain.includes('.')
      ? `https://${project.subdomain}`
      : `https://${project.subdomain}.pages.dev`;

    return {
      url: deployment.url,
      metadata: {
        deploymentId: deployment.id,
        projectId: project.id,
        projectName: project.name,
        productionUrl,
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

    // Log the project response for debugging
    console.log('Cloudflare project response:', data);

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

  private async createDeployment(
    projectName: string,
    manifest: Record<string, string>,
    fileContents: Record<string, Uint8Array>
  ): Promise<CloudflareDeployment> {
    const url = `${this.baseURL}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    // Create FormData with manifest
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));

    // Add all files to FormData
    for (const [path, content] of Object.entries(fileContents)) {
      const blob = new Blob([content]);
      formData.append(path, blob, path);
    }

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

    // Log the response for debugging
    console.log('Cloudflare deployment response:', data);

    return data.result;
  }

  private async collectFiles(
    dirPath: string,
    relativePath: string,
    manifest: Record<string, string>,
    fileContents: Record<string, Uint8Array>
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Recursively collect files from subdirectories
          await this.collectFiles(fullPath, entryRelativePath, manifest, fileContents);
        } else if (entry.isFile()) {
          try {
            // Read file content
            const fileContent = await this.fs.readFile(fullPath);

            // Convert to Uint8Array
            let content: Uint8Array;
            if (typeof fileContent === 'string') {
              content = new TextEncoder().encode(fileContent);
            } else {
              content = fileContent;
            }

            // Calculate hash for manifest
            const hash = await this.calculateHash(content);

            // Add to manifest with leading slash
            const manifestPath = `/${entryRelativePath}`;
            manifest[manifestPath] = hash;

            // Store file content
            fileContents[entryRelativePath] = content;
          } catch (error) {
            console.warn(`Failed to read file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }

  private async calculateHash(content: Uint8Array): Promise<string> {
    // Use SHA-256 to calculate hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', content);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
}
