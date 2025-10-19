import JSZip from 'jszip';
import { NIP98 } from '@nostrify/nostrify';
import { N64 } from '@nostrify/nostrify/utils';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, ShakespeareDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

/**
 * Shakespeare Deploy Adapter
 * Uses NIP-98 authentication with Nostr signer
 */
export class ShakespeareAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private signer: ShakespeareDeployConfig['signer'];
  private host: string;
  private subdomain?: string;
  private corsProxy?: string;

  constructor(config: ShakespeareDeployConfig) {
    this.fs = config.fs;
    this.signer = config.signer;
    this.host = config.host || 'shakespeare.wtf';
    this.subdomain = config.subdomain;
    this.corsProxy = config.corsProxy;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectId, projectPath } = options;

    // Use custom subdomain if provided, otherwise construct from projectId
    const hostname = this.subdomain
      ? `${this.subdomain}.${this.host}`
      : `${projectId}.${this.host}`;
    const deployUrl = `https://${this.host}/deploy`;
    const siteUrl = `https://${hostname}`;

    // Check if dist directory exists and contains index.html
    const distPath = `${projectPath}/dist`;
    try {
      await this.fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    // Create ZIP of dist directory
    const zip = new JSZip();
    await this.addDirectoryToZip(distPath, zip);

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create FormData
    const formData = new FormData();
    formData.append('hostname', hostname);
    formData.append('file', zipBlob, `${projectId}.zip`);

    // Create the request
    let request = new Request(deployUrl, {
      method: 'POST',
      body: formData,
    });

    // Create NIP-98 token for authentication
    const template = await NIP98.template(request);
    const event = await this.signer.signEvent(template);
    const token = N64.encodeEvent(event);

    // Add the Authorization header
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Nostr ${token}`);
    request = new Request(request, { headers });

    // Apply proxy if configured
    if (this.corsProxy) {
      request = new Request(proxyUrl(this.corsProxy, request.url), request);
    }

    // Deploy
    const response = await fetch(request);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Deployment failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return {
      url: siteUrl,
      metadata: {
        hostname,
        provider: 'shakespeare',
      },
    };
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
