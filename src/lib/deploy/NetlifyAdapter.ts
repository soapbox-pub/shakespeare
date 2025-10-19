import JSZip from 'jszip';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, NetlifyDeployConfig } from './types';

interface NetlifySite {
  id: string;
  site_id: string;
  name: string;
  url: string;
  admin_url: string;
}

interface NetlifyBuildResponse {
  id: string;
  deploy_id: string;
  state: string;
  error?: string;
}

/**
 * Netlify Deploy Adapter
 * Uses Netlify API with personal access token
 */
export class NetlifyAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private apiKey: string;
  private baseURL: string;
  private siteName?: string;
  private siteId?: string;

  constructor(config: NetlifyDeployConfig) {
    this.fs = config.fs;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.netlify.com/api/v1';
    this.siteName = config.siteName;
    this.siteId = config.siteId;
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

    // Get or create site
    let activeSiteId = this.siteId;
    let siteUrl = '';

    if (!activeSiteId) {
      // Create new site
      const site = await this.createSite(this.siteName || projectId);
      activeSiteId = site.id;
      siteUrl = site.url;
    } else {
      // Get existing site URL
      const site = await this.getSite(activeSiteId);
      siteUrl = site.url;
    }

    // Create ZIP of dist directory
    const zip = new JSZip();
    await this.addDirectoryToZip(distPath, zip);

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Deploy to Netlify
    await this.triggerDeploy(activeSiteId, zipBlob);

    return {
      url: siteUrl,
      metadata: {
        siteId: activeSiteId,
        provider: 'netlify',
      },
    };
  }

  private async createSite(name: string): Promise<NetlifySite> {
    const response = await fetch(`${this.baseURL}/sites`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        created_via: 'shakespeare',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create Netlify site: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async getSite(siteId: string): Promise<NetlifySite> {
    const response = await fetch(`${this.baseURL}/sites/${siteId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get Netlify site: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async triggerDeploy(siteId: string, zipBlob: Blob): Promise<NetlifyBuildResponse> {
    const response = await fetch(`${this.baseURL}/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: zipBlob,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to trigger Netlify build: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async addDirectoryToZip(dirPath: string, zip: JSZip): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.isDirectory()) {
          // Create folder in zip and recursively add its contents
          const folder = zip.folder(entry.name);
          if (folder) {
            await this.addDirectoryToZip(fullPath, folder);
          }
        } else if (entry.isFile()) {
          // Add file to zip
          try {
            const fileContent = await this.fs.readFile(fullPath);
            zip.file(entry.name, fileContent);
          } catch {
            console.warn(`Failed to read file ${fullPath}`);
          }
        }
      }
    } catch {
      console.warn(`Failed to read directory ${dirPath}`);
    }
  }
}
