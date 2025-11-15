import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, CloudflareDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface CloudflareFile {
  key: string;
  value: string;
  metadata: {
    contentType: string;
  };
  base64: boolean;
}

interface CloudflareDeployment {
  id: string;
  url: string;
  environment: string;
  deployment_trigger: {
    type: string;
  };
  stages: Array<{
    name: string;
    status: string;
  }>;
  project_name: string;
}

interface CloudflareProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  created_on: string;
}

/**
 * Cloudflare Pages Deploy Adapter
 * Uses Cloudflare Pages Direct Upload API with API token
 * 
 * Mimics the behavior of "wrangler pages deploy dist"
 */
export class CloudflareAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private apiToken: string;
  private accountId: string;
  private baseURL: string;
  private projectName?: string;
  private branch?: string;
  private corsProxy?: string;

  constructor(config: CloudflareDeployConfig) {
    this.fs = config.fs;
    this.apiToken = config.apiToken;
    this.accountId = config.accountId;
    this.baseURL = config.baseURL || 'https://api.cloudflare.com/client/v4';
    this.projectName = config.projectName;
    this.branch = config.branch || 'main';
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

    // Determine project name
    const cfProjectName = this.projectName || projectId;

    // Ensure project exists or create it
    let project: CloudflareProject;
    try {
      project = await this.getProject(cfProjectName);
    } catch {
      // Project doesn't exist, create it
      project = await this.createProject(cfProjectName);
    }

    // Collect all files from dist directory
    const manifest: Record<string, string> = {};
    const files: CloudflareFile[] = [];
    await this.collectFiles(distPath, '', files, manifest);

    // Create deployment using Direct Upload API
    const deployment = await this.createDeployment(cfProjectName, files, manifest);

    // Construct the deployment URL
    const deploymentUrl = deployment.url || `https://${deployment.id}.${project.subdomain}.pages.dev`;

    return {
      url: deploymentUrl,
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
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get Cloudflare Pages project: ${response.status} ${response.statusText}. ${errorText}`);
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
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        production_branch: this.branch,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create Cloudflare Pages project: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async createDeployment(
    projectName: string,
    files: CloudflareFile[],
    manifest: Record<string, string>
  ): Promise<CloudflareDeployment> {
    const url = `${this.baseURL}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    // Create form data for multipart upload
    const formData = new FormData();

    // Add manifest
    formData.append('manifest', JSON.stringify(manifest));

    // Add each file
    for (const file of files) {
      const blob = new Blob([file.value], { type: file.metadata.contentType });
      formData.append(file.key, blob);
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        // Don't set Content-Type - browser will set it with boundary for multipart/form-data
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create Cloudflare Pages deployment: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async collectFiles(
    dirPath: string,
    relativePath: string,
    files: CloudflareFile[],
    manifest: Record<string, string>
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Recursively collect files from subdirectories
          await this.collectFiles(fullPath, entryRelativePath, files, manifest);
        } else if (entry.isFile()) {
          try {
            // Read file content
            const fileContent = await this.fs.readFile(fullPath);

            // Determine content type based on file extension
            const contentType = this.getContentType(entry.name);

            // Convert to base64 for binary files, or keep as string for text files
            let base64Content: string;
            let isBase64 = false;

            if (this.isBinaryFile(entry.name)) {
              // Handle binary files (images, fonts, etc.)
              if (typeof fileContent === 'string') {
                base64Content = btoa(fileContent);
              } else {
                // Handle Uint8Array
                const binary = Array.from(fileContent)
                  .map(byte => String.fromCharCode(byte))
                  .join('');
                base64Content = btoa(binary);
              }
              isBase64 = true;
            } else {
              // Handle text files (HTML, CSS, JS, etc.)
              if (typeof fileContent === 'string') {
                base64Content = fileContent;
              } else {
                // Decode Uint8Array to string
                const decoder = new TextDecoder();
                base64Content = decoder.decode(fileContent);
              }
            }

            // Add to files array
            files.push({
              key: entryRelativePath,
              value: base64Content,
              metadata: {
                contentType,
              },
              base64: isBase64,
            });

            // Add to manifest (hash placeholder - Cloudflare will compute actual hash)
            manifest[entryRelativePath] = '';
          } catch (error) {
            console.warn(`Failed to read file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      // Text
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'mjs': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      'md': 'text/markdown',

      // Images
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'ico': 'image/x-icon',

      // Fonts
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
      'eot': 'application/vnd.ms-fontobject',

      // Other
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'wasm': 'application/wasm',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Determine if a file should be treated as binary
   */
  private isBinaryFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();

    const binaryExtensions = [
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico',
      'woff', 'woff2', 'ttf', 'otf', 'eot',
      'pdf', 'zip', 'wasm',
    ];

    return binaryExtensions.includes(ext || '');
  }
}
