import JSZip from 'jszip';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, NetlifyDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface NetlifySite {
  id: string;
  site_id: string;
  name: string;
  url: string;
  admin_url: string;
}

interface NetlifyDeployResponse {
  id: string;
  deploy_id: string;
  state: string;
  error?: string;
  required?: string[];
  required_functions?: string[];
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
  private corsProxy?: string;

  constructor(config: NetlifyDeployConfig) {
    this.fs = config.fs;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.netlify.com/api/v1';
    this.siteName = config.siteName;
    this.siteId = config.siteId;
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

    // Collect files and their SHA1 hashes
    const files: Record<string, string> = {};
    const fileContents = new Map<string, Uint8Array>();
    await this.collectFiles(distPath, '', files, fileContents);

    // Ensure _redirects file exists for SPA routing
    await this.ensureRedirectsInFiles(distPath, files, fileContents);

    // Collect functions and their SHA256 hashes
    const functions: Record<string, string> = {};
    const functionZips = new Map<string, Blob>();
    const functionsPath = `${projectPath}/netlify/functions`;
    await this.collectFunctions(functionsPath, functions, functionZips);

    // Create deploy with file and function digests
    const deployResponse = await this.createDeployWithDigest(activeSiteId, files, functions);

    // Upload required files
    if (deployResponse.required && deployResponse.required.length > 0) {
      await this.uploadFiles(deployResponse.id, files, fileContents, deployResponse.required);
    }

    // Upload required functions
    if (deployResponse.required_functions && deployResponse.required_functions.length > 0) {
      await this.uploadFunctions(deployResponse.id, functions, functionZips, deployResponse.required_functions);
    }

    return {
      url: siteUrl,
      metadata: {
        siteId: activeSiteId,
        deployId: deployResponse.id,
        provider: 'netlify',
        functionsDeployed: Object.keys(functions).length,
      },
    };
  }

  private async createSite(name: string): Promise<NetlifySite> {
    const url = `${this.baseURL}/sites`;
    const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

    const response = await fetch(targetUrl, {
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
    const url = `${this.baseURL}/sites/${siteId}`;
    const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

    const response = await fetch(targetUrl, {
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

  private async createDeployWithDigest(
    siteId: string,
    files: Record<string, string>,
    functions: Record<string, string>
  ): Promise<NetlifyDeployResponse> {
    const url = `${this.baseURL}/sites/${siteId}/deploys`;
    const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

    const body: { files: Record<string, string>; functions?: Record<string, string> } = { files };
    if (Object.keys(functions).length > 0) {
      body.functions = functions;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create Netlify deploy: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }

  private async collectFiles(
    dirPath: string,
    relativePath: string,
    files: Record<string, string>,
    fileContents: Map<string, Uint8Array>
  ): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.collectFiles(fullPath, relPath, files, fileContents);
        } else if (entry.isFile()) {
          try {
            const fileContent = await this.fs.readFile(fullPath);
            const sha1 = await this.calculateSHA1(fileContent);
            files[`/${relPath}`] = sha1;
            fileContents.set(sha1, fileContent);
          } catch {
            console.warn(`Failed to read file ${fullPath}`);
          }
        }
      }
    } catch {
      console.warn(`Failed to read directory ${dirPath}`);
    }
  }

  /**
   * Ensures _redirects file exists in the deployment for SPA routing
   * If not present in dist directory, adds it to the files manifest
   */
  private async ensureRedirectsInFiles(
    distPath: string,
    files: Record<string, string>,
    fileContents: Map<string, Uint8Array>
  ): Promise<void> {
    const redirectsPath = `${distPath}/_redirects`;

    try {
      // Check if _redirects file already exists
      const stat = await this.fs.stat(redirectsPath);
      if (!stat.isFile()) {
        throw new Error('_redirects is not a file');
      }
      // File exists, already collected by collectFiles
    } catch {
      // File doesn't exist, add default _redirects
      const defaultRedirects = '/* /index.html 200';
      const content = new TextEncoder().encode(defaultRedirects);
      const sha1 = await this.calculateSHA1(content);
      files['/_redirects'] = sha1;
      fileContents.set(sha1, content);
    }
  }

  private async collectFunctions(
    functionsPath: string,
    functions: Record<string, string>,
    functionZips: Map<string, Blob>
  ): Promise<void> {
    try {
      // Check if functions directory exists
      const stat = await this.fs.stat(functionsPath);
      if (!stat.isDirectory()) {
        return;
      }

      const entries = await this.fs.readdir(functionsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const fullPath = `${functionsPath}/${entry.name}`;
          
          // Only process .mjs files (ES modules)
          // Note: .js and .ts files require bundling which is not supported in this adapter
          if (entry.name.endsWith('.mjs')) {
            try {
              const functionContent = await this.fs.readFile(fullPath);
              
              // Create a zip for this function
              const zip = new JSZip();
              zip.file(entry.name, functionContent);
              const zipBlob = await zip.generateAsync({ type: 'blob' });
              
              // Calculate SHA256 hash
              const sha256 = await this.calculateSHA256FromBlob(zipBlob);
              
              // Function name without extension
              const functionName = entry.name.replace(/\.mjs$/, '');
              functions[functionName] = sha256;
              functionZips.set(sha256, zipBlob);
            } catch (error) {
              console.warn(`Failed to process function ${entry.name}:`, error);
            }
          }
        }
      }
    } catch {
      // Functions directory doesn't exist, skip
    }
  }

  private async uploadFiles(
    deployId: string,
    files: Record<string, string>,
    fileContents: Map<string, Uint8Array>,
    requiredShas: string[]
  ): Promise<void> {
    const requiredSet = new Set(requiredShas);
    
    for (const [filePath, sha1] of Object.entries(files)) {
      if (requiredSet.has(sha1)) {
        const content = fileContents.get(sha1);
        if (!content) {
          console.warn(`Content not found for ${filePath} (${sha1})`);
          continue;
        }

        // Escape file path for URL
        const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
        const url = `${this.baseURL}/deploys/${deployId}/files${encodedPath}`;
        const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

        const response = await fetch(targetUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/octet-stream',
          },
          body: content,
        });

        if (!response.ok) {
          console.warn(`Failed to upload file ${filePath}: ${response.status} ${response.statusText}`);
        }
      }
    }
  }

  private async uploadFunctions(
    deployId: string,
    functions: Record<string, string>,
    functionZips: Map<string, Blob>,
    requiredShas: string[]
  ): Promise<void> {
    const requiredSet = new Set(requiredShas);
    
    for (const [functionName, sha256] of Object.entries(functions)) {
      if (requiredSet.has(sha256)) {
        const zipBlob = functionZips.get(sha256);
        if (!zipBlob) {
          console.warn(`Zip not found for function ${functionName} (${sha256})`);
          continue;
        }

        const url = `${this.baseURL}/deploys/${deployId}/functions/${encodeURIComponent(functionName)}?runtime=js`;
        const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

        const response = await fetch(targetUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/octet-stream',
          },
          body: zipBlob,
        });

        if (!response.ok) {
          console.warn(`Failed to upload function ${functionName}: ${response.status} ${response.statusText}`);
        }
      }
    }
  }

  private async calculateSHA1(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async calculateSHA256FromBlob(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
