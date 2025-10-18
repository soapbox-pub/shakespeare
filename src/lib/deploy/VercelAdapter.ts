import type { DeployAdapter, DeployOptions, DeployResult, VercelDeployConfig } from './types';

interface VercelFile {
  file: string;
  data: string;
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
  private config: VercelDeployConfig;

  constructor(config: VercelDeployConfig) {
    this.config = config;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectId, projectName, fs, projectPath } = options;
    const { apiKey, teamId } = this.config;

    // Check if dist directory exists and contains index.html
    const distPath = `${projectPath}/dist`;
    try {
      await fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    // Collect all files from dist directory
    const files: VercelFile[] = [];
    await this.collectFiles(fs, distPath, '', files);

    // Create deployment payload
    const deploymentPayload = {
      name: this.config.projectName || projectName || projectId,
      files,
      projectSettings: {
        framework: null, // Static deployment
      },
      target: 'production' as const,
    };

    // Build API URL with optional team parameter
    let apiUrl = 'https://api.vercel.com/v13/deployments';
    if (teamId) {
      apiUrl += `?teamId=${teamId}`;
    }

    // Deploy to Vercel
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
    fs: DeployOptions['fs'],
    dirPath: string,
    relativePath: string,
    files: VercelFile[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Recursively collect files from subdirectories
          await this.collectFiles(fs, fullPath, entryRelativePath, files);
        } else if (entry.isFile()) {
          try {
            // Read file content
            const fileContent = await fs.readFile(fullPath);

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
