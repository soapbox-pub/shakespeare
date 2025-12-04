import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, CloudflareDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface AssetManifest {
  [path: string]: { hash: string; size: number };
}

interface InitializeAssetsResponse {
  buckets: string[][];
  jwt: string;
}

interface UploadResponse {
  jwt?: string;
}

interface WorkerScript {
  id: string;
  etag: string;
  handlers: string[];
  modified_on: string;
  created_on: string;
  has_assets: boolean;
}

interface FileInfo {
  hash: string;
  content: Uint8Array;
  size: number;
  contentType: string;
}

/**
 * Cloudflare Workers Deploy Adapter
 * Uses Cloudflare Workers API with static assets support
 *
 * Implements the Workers Assets upload workflow:
 * 1. Build asset manifest with file hashes
 * 2. Initialize upload session to get buckets of files to upload
 * 3. Upload files in buckets using FormData with base64 content
 * 4. Deploy worker with assets JWT
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

    const scriptName = this.projectName || projectId;

    // Step 1: Collect all files and build manifest
    const files = new Map<string, FileInfo>();
    await this.collectFiles(distPath, '', files);

    const manifest: AssetManifest = {};
    for (const [filePath, fileInfo] of files) {
      // Normalize path with leading slash
      const normalizedPath = '/' + filePath.replace(/\\/g, '/');
      manifest[normalizedPath] = {
        hash: fileInfo.hash,
        size: fileInfo.size,
      };
    }

    // Step 2: Initialize upload session
    const initResponse = await this.initializeUploadSession(scriptName, manifest);

    // Step 3: Upload files in buckets
    let completionJwt = initResponse.jwt;

    if (initResponse.buckets.flat().length > 0) {
      // Create lookup from hash to file info
      const hashToFile = new Map<string, { path: string; info: FileInfo }>();
      for (const [filePath, fileInfo] of files) {
        hashToFile.set(fileInfo.hash, { path: filePath, info: fileInfo });
      }

      // Upload each bucket
      for (const bucket of initResponse.buckets) {
        const uploadResult = await this.uploadBucket(
          initResponse.jwt,
          bucket,
          hashToFile
        );
        if (uploadResult.jwt) {
          completionJwt = uploadResult.jwt;
        }
      }
    }

    // Step 4: Deploy the worker with assets
    const deployment = await this.deployWorker(scriptName, completionJwt);

    // Step 5: Enable the workers.dev subdomain for this script
    await this.enableWorkersDevSubdomain(scriptName);

    // Step 6: Get the account's workers.dev subdomain
    const subdomain = await this.getWorkersSubdomain();

    // Construct the URL
    const workerUrl = `https://${scriptName}.${subdomain}.workers.dev`;

    return {
      url: workerUrl,
      metadata: {
        scriptId: deployment.id,
        scriptName: scriptName,
        provider: 'cloudflare-workers',
        hasAssets: deployment.has_assets,
        modifiedOn: deployment.modified_on,
      },
    };
  }

  private async getWorkersSubdomain(): Promise<string> {
    const url = `${this.baseURL}/accounts/${this.accountId}/workers/subdomain`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get workers subdomain: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result.subdomain;
  }

  private async enableWorkersDevSubdomain(scriptName: string): Promise<void> {
    const url = `${this.baseURL}/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        enabled: true,
        previews_enabled: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to enable workers.dev subdomain: ${response.status} ${response.statusText}. ${errorText}`);
    }
  }

  private async initializeUploadSession(
    scriptName: string,
    manifest: AssetManifest
  ): Promise<InitializeAssetsResponse> {
    const url = `${this.baseURL}/accounts/${this.accountId}/workers/scripts/${scriptName}/assets-upload-session`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manifest }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to initialize upload session: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async uploadBucket(
    jwt: string,
    bucket: string[],
    hashToFile: Map<string, { path: string; info: FileInfo }>
  ): Promise<UploadResponse> {
    const url = `${this.baseURL}/accounts/${this.accountId}/workers/assets/upload?base64=true`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const formData = new FormData();

    for (const fileHash of bucket) {
      const fileData = hashToFile.get(fileHash);
      if (!fileData) {
        throw new Error(`File with hash ${fileHash} not found in manifest`);
      }

      // Convert content to base64
      const base64Content = this.uint8ArrayToBase64(fileData.info.content);

      // Use content type or "application/null" to signal no content-type header
      const contentType = fileData.info.contentType || 'application/null';

      // Create a File/Blob with the base64 content
      const blob = new Blob([base64Content], { type: contentType });
      formData.append(fileHash, blob, fileHash);
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to upload assets: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result || {};
  }

  private async deployWorker(scriptName: string, assetsJwt: string): Promise<WorkerScript> {
    const url = `${this.baseURL}/accounts/${this.accountId}/workers/scripts/${scriptName}`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    // Create a minimal worker script that serves static assets
    // This is an assets-only worker - Cloudflare will automatically serve the uploaded assets
    const workerScript = `
export default {
  async fetch(request, env) {
    // This worker only serves static assets
    // The assets are automatically served by Cloudflare's asset handler
    return new Response('Not Found', { status: 404 });
  }
};
`;

    const formData = new FormData();

    // Add the worker script as the main module
    const scriptBlob = new Blob([workerScript], { type: 'application/javascript+module' });
    formData.append('worker.js', scriptBlob, 'worker.js');

    // Add metadata with assets configuration
    const metadata = {
      main_module: 'worker.js',
      compatibility_date: new Date().toISOString().split('T')[0],
      assets: {
        jwt: assetsJwt,
        config: {
          html_handling: 'auto-trailing-slash',
          not_found_handling: 'single-page-application',
        },
      },
    };

    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to deploy worker: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  }

  private async collectFiles(
    dirPath: string,
    relativePath: string,
    files: Map<string, FileInfo>
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.collectFiles(fullPath, entryRelativePath, files);
        } else if (entry.isFile()) {
          try {
            const fileContent = await this.fs.readFile(fullPath);

            // Convert to Uint8Array
            let content: Uint8Array;
            if (typeof fileContent === 'string') {
              content = new TextEncoder().encode(fileContent);
            } else {
              content = fileContent;
            }

            // Calculate hash (same algorithm as Wrangler uses)
            const hash = await this.calculateHash(content);

            // Determine content type
            const contentType = this.getContentType(entry.name);

            files.set(entryRelativePath, {
              hash,
              content,
              size: content.length,
              contentType,
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

  private async calculateHash(content: Uint8Array): Promise<string> {
    // Use xxHash algorithm like Wrangler does, but fall back to SHA-256 for browser compatibility
    const hashBuffer = await crypto.subtle.digest('SHA-256', content);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Take first 16 bytes (32 hex chars) to match Wrangler's hash length
    const hashHex = hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'mjs': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'webp': 'image/webp',
      'avif': 'image/avif',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
      'otf': 'font/otf',
      'txt': 'text/plain',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'wasm': 'application/wasm',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
