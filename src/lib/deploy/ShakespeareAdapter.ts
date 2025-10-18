import JSZip from 'jszip';
import { NIP98Client } from '@nostrify/nostrify';
import type { DeployAdapter, DeployOptions, DeployResult, ShakespeareDeployConfig } from './types';

/**
 * Shakespeare Deploy Adapter
 * Uses NIP-98 authentication with Nostr signer
 */
export class ShakespeareAdapter implements DeployAdapter {
  private config: ShakespeareDeployConfig;

  constructor(config: ShakespeareDeployConfig) {
    this.config = config;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectId, fs, projectPath } = options;
    const { signer, deployServer = 'shakespeare.wtf', customHostname } = this.config;

    // Use custom hostname if provided, otherwise construct from projectId.deployServer
    const hostname = customHostname || `${projectId}.${deployServer}`;
    const deployUrl = `https://${deployServer}/deploy`;
    const siteUrl = `https://${hostname}`;

    // Check if dist directory exists and contains index.html
    const distPath = `${projectPath}/dist`;
    try {
      await fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    // Create ZIP of dist directory
    const zip = new JSZip();
    await this.addDirectoryToZip(fs, distPath, zip);

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Create FormData
    const formData = new FormData();
    formData.append('hostname', hostname);
    formData.append('file', zipBlob, `${projectId}.zip`);

    // Create NIP-98 authenticated client and deploy
    const nip98Client = new NIP98Client({ signer });
    const response = await nip98Client.fetch(deployUrl, {
      method: 'POST',
      body: formData,
    });

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
