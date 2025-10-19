import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, VercelDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface VercelFile {
  file: string;
  data: string;
  encoding: 'base64';
}

interface VercelDeployment {
  id: string;
  url: string;
  name: string;
  readyState: string;
}

/**
 * Vercel Deploy Adapter
 * Uses Vercel REST API with access token
 */
export class VercelAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private apiKey: string;
  private baseURL: string;
  private teamId?: string;
  private projectName?: string;
  private corsProxy?: string;

  constructor(config: VercelDeployConfig) {
    this.fs = config.fs;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.vercel.com';
    this.teamId = config.teamId;
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

    // Collect all files from dist directory
    const files: VercelFile[] = [];
    await this.collectFiles(distPath, '', files);

    // Create deployment payload
    const deploymentPayload = {
      name: this.projectName || projectId,
      files,
      projectSettings: {
        framework: null, // Static deployment
      },
      target: 'production' as const,
    };

    // Build API URL with optional team parameter
    let apiUrl = `${this.baseURL}/v13/deployments`;
    if (this.teamId) {
      apiUrl += `?teamId=${this.teamId}`;
    }

    // Apply proxy if configured
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, apiUrl) : apiUrl;

    // Deploy to Vercel
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deploymentPayload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to deploy to Vercel: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const deployment: VercelDeployment = await response.json();

    return {
      url: `https://${deployment.url}`,
      metadata: {
        deploymentId: deployment.id,
        provider: 'vercel',
        readyState: deployment.readyState,
      },
    };
  }

  private async collectFiles(
    dirPath: string,
    relativePath: string,
    files: VercelFile[]
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Recursively collect files from subdirectories
          await this.collectFiles(fullPath, entryRelativePath, files);
        } else if (entry.isFile()) {
          try {
            // Read file content
            const fileContent = await this.fs.readFile(fullPath);

            // Convert to base64 for Vercel API
            let base64Content: string;
            if (typeof fileContent === 'string') {
              base64Content = btoa(fileContent);
            } else {
              // Handle Uint8Array
              const binary = Array.from(fileContent)
                .map(byte => String.fromCharCode(byte))
                .join('');
              base64Content = btoa(binary);
            }

            files.push({
              file: entryRelativePath,
              data: base64Content,
              encoding: 'base64',
            });
          } catch (error) {
            console.warn(`Failed to read file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }
}
