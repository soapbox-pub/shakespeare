import JSZip from 'jszip';
import type { DeployProvider, DeployOptions, DeployResult, NetlifyDeployConfig } from './types';

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
 * Netlify Deploy Provider
 * Uses Netlify API with personal access token
 */
export class NetlifyDeployProvider implements DeployProvider {
  private config: NetlifyDeployConfig;

  constructor(config: NetlifyDeployConfig) {
    this.config = config;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectId, projectName, fs, projectPath } = options;
    const { apiKey, siteId, siteName } = this.config;

    // Check if dist directory exists and contains index.html
    const distPath = `${projectPath}/dist`;
    try {
      await fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    // Get or create site
    let activeSiteId = siteId;
    let siteUrl = '';

    if (!activeSiteId) {
      // Create new site
      const site = await this.createSite(apiKey, siteName || projectName || projectId);
      activeSiteId = site.id;
      siteUrl = site.url;
    } else {
      // Get existing site URL
      const site = await this.getSite(apiKey, activeSiteId);
      siteUrl = site.url;
    }

    // Create ZIP of dist directory
    const zip = new JSZip();
    await this.addDirectoryToZip(fs, distPath, zip);

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Deploy to Netlify
    await this.triggerBuild(apiKey, activeSiteId, zipBlob, `Deploy from Shakespeare - ${new Date().toISOString()}`);

    return {
      url: siteUrl,
      metadata: {
        siteId: activeSiteId,
        provider: 'netlify',
      },
    };
  }

  private async createSite(apiKey: string, name: string): Promise<NetlifySite> {
    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

  private async getSite(apiKey: string, siteId: string): Promise<NetlifySite> {
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get Netlify site: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async triggerBuild(apiKey: string, siteId: string, zipBlob: Blob, title: string): Promise<NetlifyBuildResponse> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('zip', zipBlob, 'deploy.zip');

    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/builds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to trigger Netlify build: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async addDirectoryToZip(fs: DeployOptions['fs'], dirPath: string, zip: JSZip): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.isDirectory()) {
          // Create folder in zip and recursively add its contents
          const folder = zip.folder(entry.name);
          if (folder) {
            await this.addDirectoryToZip(fs, fullPath, folder);
          }
        } else if (entry.isFile()) {
          // Add file to zip
          try {
            const fileContent = await fs.readFile(fullPath);
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
