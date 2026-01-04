import JSZip from 'jszip';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, APKBuilderDeployConfig, APKBuildType } from './types';
import { proxyUrl } from '../proxyUrl';

interface APKBuildStatus {
  id: string;
  status: 'queued' | 'building' | 'complete' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  apkSize?: number;
  logs?: string[];
}

/**
 * APK Builder Deploy Adapter
 * Builds Android APKs from web projects using a Capacitor build service
 */
export class APKBuilderAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private buildServerUrl: string;
  private apiKey: string;
  private appName: string;
  private packageId: string;
  private buildType: APKBuildType;
  private corsProxy?: string;
  private onProgress?: (status: APKBuildStatus) => void;

  constructor(config: APKBuilderDeployConfig) {
    this.fs = config.fs;
    this.buildServerUrl = config.buildServerUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.appName = config.appName;
    this.packageId = config.packageId;
    this.buildType = config.buildType || 'debug';
    this.corsProxy = config.corsProxy;
    this.onProgress = config.onProgress;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectPath } = options;
    const distPath = `${projectPath}/dist`;

    // Verify dist exists
    try {
      await this.fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No dist folder found. Build the project first using the Build button.');
    }

    // Create ZIP of dist folder
    const zip = new JSZip();
    const distFolder = zip.folder('dist');
    if (!distFolder) {
      throw new Error('Failed to create ZIP folder');
    }
    await this.addDirectoryToZip(distPath, distFolder);
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Submit build request
    const buildId = await this.submitBuild(zipBlob);

    // Poll for completion
    const result = await this.waitForBuild(buildId);

    return result;
  }

  private async submitBuild(zipBlob: Blob): Promise<string> {
    const url = `${this.buildServerUrl}/api/build`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const formData = new FormData();
    formData.append('project', zipBlob, 'project.zip');
    formData.append('config', JSON.stringify({
      appName: this.appName,
      packageId: this.packageId,
      buildType: this.buildType,
    }));

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Build submission failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.buildId;
  }

  private async waitForBuild(buildId: string): Promise<DeployResult> {
    const maxWait = 10 * 60 * 1000; // 10 minutes
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const status = await this.getStatus(buildId);

      if (this.onProgress) {
        this.onProgress(status);
      }

      if (status.status === 'complete') {
        const downloadUrl = `${this.buildServerUrl}/api/build/${buildId}/download?apiKey=${encodeURIComponent(this.apiKey)}`;

        return {
          url: downloadUrl,
          metadata: {
            buildId,
            type: 'apk',
            appName: this.appName,
            packageId: this.packageId,
            buildType: this.buildType,
            apkSize: status.apkSize,
          },
        };
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'APK build failed');
      }

      if (status.status === 'cancelled') {
        throw new Error('APK build was cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('APK build timed out after 10 minutes');
  }

  private async getStatus(buildId: string): Promise<APKBuildStatus> {
    const url = `${this.buildServerUrl}/api/build/${buildId}/status`;
    const targetUrl = this.corsProxy ? proxyUrl(this.corsProxy, url) : url;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get build status: ${response.status}`);
    }

    return response.json();
  }

  private async addDirectoryToZip(dirPath: string, zip: JSZip): Promise<void> {
    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.isDirectory()) {
          const folder = zip.folder(entry.name);
          if (folder) {
            await this.addDirectoryToZip(fullPath, folder);
          }
        } else if (entry.isFile()) {
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
