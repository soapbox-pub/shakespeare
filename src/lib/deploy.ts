import JSZip from 'jszip';
import { NIP98Client } from '@nostrify/nostrify';
import type { NostrSigner } from '@nostrify/nostrify';
import type { JSRuntimeFS } from './JSRuntime';

export interface DeployOptions {
  /** Project ID to use for hostname construction */
  projectId: string;
  /** Deploy server domain (e.g., "shakespeare.wtf") */
  deployServer: string;
  /** Filesystem instance containing the project */
  fs: JSRuntimeFS;
  /** Path to the project directory */
  projectPath: string;
  /** Nostr signer for NIP-98 authentication */
  signer: NostrSigner;
}

export interface DeployResult {
  /** The deployed URL */
  url: string;
  /** The hostname used */
  hostname: string;
}

/**
 * Deploy a project by creating a ZIP of the dist directory and uploading it
 * to the deployment server using NIP-98 authentication.
 */
export async function deployProject(options: DeployOptions): Promise<DeployResult> {
  const { projectId, deployServer, fs, projectPath, signer } = options;

  // Construct hostname and URL
  const hostname = `${projectId}.${deployServer}`;
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
  await addDirectoryToZip(fs, distPath, zip);

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
    hostname,
  };
}

/**
 * Recursively add all files in a directory to a JSZip instance
 */
async function addDirectoryToZip(fs: JSRuntimeFS, dirPath: string, zip: JSZip): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;

      if (entry.isDirectory()) {
        // Create folder in zip and recursively add its contents
        const folder = zip.folder(entry.name);
        if (folder) {
          await addDirectoryToZip(fs, fullPath, folder);
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