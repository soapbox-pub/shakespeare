import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, RailwayDeployConfig } from './types';
import { proxyUrl } from '../proxyUrl';

interface Workspace {
  id: string;
  name: string;
  team: {
    id: string;
  } | null;
  projects: {
    edges: Array<{
      node: Project;
    }>;
  };
}

interface Project {
  id: string;
  name: string;
  environments: {
    edges: Array<{
      node: Environment;
    }>;
  };
  services: {
    edges: Array<{
      node: Service;
    }>;
  };
}

interface Environment {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
}

interface DeploymentResponse {
  deploymentId: string;
  url: string;
  logsUrl?: string;
  deploymentDomain: string;
}

/**
 * Railway Deploy Adapter
 * Uses Railway GraphQL API and REST upload endpoint
 *
 * Implements the Railway deployment workflow:
 * 1. Query for workspaces and projects (or use provided IDs)
 * 2. Create project if needed
 * 3. Create service if needed
 * 4. Create tarball of entire source code (excluding common dev files)
 * 5. Upload tarball to Railway via multipart/form-data
 */
export class RailwayAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private apiKey: string;
  private baseURL: string;
  private workspaceId?: string;
  private projectId?: string;
  private environmentId?: string;
  private serviceId?: string;
  private projectName?: string;
  private corsProxy?: string;

  constructor(config: RailwayDeployConfig) {
    this.fs = config.fs;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://backboard.railway.com';
    this.workspaceId = config.workspaceId;
    this.projectId = config.projectId;
    this.environmentId = config.environmentId;
    this.serviceId = config.serviceId;
    this.projectName = config.projectName;
    this.corsProxy = config.corsProxy;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectId, projectPath } = options;

    // Step 1: Ensure we have a workspace
    if (!this.workspaceId) {
      const workspaces = await this.getWorkspaces();
      if (workspaces.length === 0) {
        throw new Error('No workspaces found. Please create a workspace on Railway first.');
      }
      this.workspaceId = workspaces[0].id;
    }

    // Step 2: Get or create project
    let activeProjectId = this.projectId;
    let activeEnvironmentId = this.environmentId;

    if (!activeProjectId) {
      const project = await this.createProject(this.projectName || projectId);
      activeProjectId = project.id;
      // Get the default production environment
      activeEnvironmentId = project.environments.edges[0]?.node.id;
    } else if (!activeEnvironmentId) {
      // If we have project ID but no environment, fetch the project to get the environment
      const project = await this.getProject(activeProjectId);
      activeEnvironmentId = project.environments.edges[0]?.node.id;
    }

    if (!activeEnvironmentId) {
      throw new Error('No environment found for project');
    }

    // Step 3: Get or create service
    let activeServiceId = this.serviceId;

    if (!activeServiceId) {
      const service = await this.createService(activeProjectId, 'web');
      activeServiceId = service.id;
    }

    // Step 4: Create tarball of source code
    const tarball = await this.createTarball(projectPath);

    // Step 5: Upload to Railway
    const deployment = await this.uploadDeployment(
      activeProjectId,
      activeEnvironmentId,
      activeServiceId,
      tarball
    );

    return {
      url: deployment.url,
      metadata: {
        deploymentId: deployment.deploymentId,
        projectId: activeProjectId,
        environmentId: activeEnvironmentId,
        serviceId: activeServiceId,
        provider: 'railway',
        deploymentDomain: deployment.deploymentDomain,
      },
    };
  }

  private async graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const url = `${this.baseURL}/graphql/v2`;
    const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Railway GraphQL request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      const errorMessages = result.errors.map((e: { message: string }) => e.message).join(', ');
      throw new Error(`Railway GraphQL error: ${errorMessages}`);
    }

    return result.data;
  }

  private async getWorkspaces(): Promise<Workspace[]> {
    const query = `
      query UserWorkspaces {
        me {
          workspaces {
            id
            name
            team {
              id
            }
            projects(first: 500) {
              edges {
                node {
                  id
                  name
                  environments {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                  services {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{ me: { workspaces: Workspace[] } }>(query);
    return data.me.workspaces;
  }

  private async getProject(projectId: string): Promise<Project> {
    const query = `
      query GetProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
          services {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{ project: Project }>(query, { projectId });
    return data.project;
  }

  private async createProject(name: string): Promise<Project> {
    const query = `
      mutation ProjectCreate($name: String, $workspaceId: String) {
        projectCreate(input: { 
          name: $name, 
          workspaceId: $workspaceId 
        }) {
          id
          name
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{ projectCreate: Project }>(query, {
      name,
      workspaceId: this.workspaceId,
    });

    return data.projectCreate;
  }

  private async createService(projectId: string, name: string): Promise<Service> {
    const query = `
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;

    const data = await this.graphqlRequest<{ serviceCreate: Service }>(query, {
      input: {
        name,
        projectId,
        source: {
          image: null,
          repo: null,
        },
      },
    });

    return data.serviceCreate;
  }

  private async createTarball(projectPath: string): Promise<Blob> {
    // Import tar library dynamically (needs to be available in the project)
    // For browser environment, we'll need to use a tar implementation
    // Using a simpler approach: collect files and create a tar-like structure

    // Collect all files excluding common dev files
    const files = new Map<string, Uint8Array>();
    await this.collectFilesForTarball(projectPath, '', files);

    // Create a simple tar.gz equivalent using browser APIs
    // Since we're in a browser environment, we'll create a structure that Railway can accept
    const tarData = await this.createTarGzBlob(files);

    return tarData;
  }

  private async collectFilesForTarball(
    dirPath: string,
    relativePath: string,
    files: Map<string, Uint8Array>
  ): Promise<void> {
    // Directories to exclude
    const excludeDirs = new Set([
      '.git',
      'node_modules',
      'dist',
      'build',
      '.next',
      '.nuxt',
      '.output',
      '.vite',
      '.cache',
      '__pycache__',
      '.pytest_cache',
      '.venv',
      'venv',
      'env',
      '.DS_Store',
      'coverage',
      '.nyc_output',
    ]);

    // Files to exclude
    const excludeFiles = new Set([
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.test',
      'npm-debug.log',
      'yarn-debug.log',
      'yarn-error.log',
      '.DS_Store',
    ]);

    try {
      const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip excluded directories and files
        if (excludeDirs.has(entry.name) || excludeFiles.has(entry.name)) {
          continue;
        }

        const fullPath = `${dirPath}/${entry.name}`;
        const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.collectFilesForTarball(fullPath, entryRelativePath, files);
        } else if (entry.isFile()) {
          try {
            const fileContent = await this.fs.readFile(fullPath);

            let bytes: Uint8Array;
            if (typeof fileContent === 'string') {
              bytes = new TextEncoder().encode(fileContent);
            } else {
              bytes = fileContent;
            }

            files.set(entryRelativePath, bytes);
          } catch (error) {
            console.warn(`Failed to read file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}:`, error);
    }
  }

  private async createTarGzBlob(files: Map<string, Uint8Array>): Promise<Blob> {
    // Create a simple tar structure
    // TAR format: 512-byte header + file data (padded to 512 bytes)
    const blocks: Uint8Array[] = [];

    for (const [filePath, content] of files) {
      // Create tar header (simplified)
      const header = new Uint8Array(512);
      const encoder = new TextEncoder();

      // File name (offset 0, 100 bytes)
      const nameBytes = encoder.encode(filePath);
      header.set(nameBytes.slice(0, 100), 0);

      // File mode (offset 100, 8 bytes) - "0000644\0"
      header.set(encoder.encode('0000644\0'), 100);

      // Owner UID (offset 108, 8 bytes) - "0000000\0"
      header.set(encoder.encode('0000000\0'), 108);

      // Group GID (offset 116, 8 bytes) - "0000000\0"
      header.set(encoder.encode('0000000\0'), 116);

      // File size in octal (offset 124, 12 bytes)
      const sizeOctal = content.length.toString(8).padStart(11, '0') + '\0';
      header.set(encoder.encode(sizeOctal), 124);

      // Modification time (offset 136, 12 bytes)
      const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
      header.set(encoder.encode(mtime), 136);

      // Checksum (offset 148, 8 bytes) - calculate after setting type flag
      header.set(encoder.encode('        '), 148);

      // Type flag (offset 156, 1 byte) - '0' for regular file
      header.set(encoder.encode('0'), 156);

      // Calculate checksum
      let checksum = 0;
      for (let i = 0; i < 512; i++) {
        checksum += header[i];
      }
      const checksumOctal = checksum.toString(8).padStart(6, '0') + '\0 ';
      header.set(encoder.encode(checksumOctal), 148);

      blocks.push(header);

      // Add file content, padded to 512-byte boundary
      const paddedSize = Math.ceil(content.length / 512) * 512;
      const paddedContent = new Uint8Array(paddedSize);
      paddedContent.set(content);
      blocks.push(paddedContent);
    }

    // Add two empty 512-byte blocks to mark end of archive
    blocks.push(new Uint8Array(512));
    blocks.push(new Uint8Array(512));

    // Combine all blocks
    const totalSize = blocks.reduce((sum, block) => sum + block.length, 0);
    const tarData = new Uint8Array(totalSize);
    let offset = 0;
    for (const block of blocks) {
      tarData.set(block, offset);
      offset += block.length;
    }

    // Compress with gzip (using CompressionStream API)
    const stream = new Blob([tarData]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();

    return compressedBlob;
  }

  private async uploadDeployment(
    projectId: string,
    environmentId: string,
    serviceId: string,
    tarball: Blob
  ): Promise<DeploymentResponse> {
    const url = `${this.baseURL}/project/${projectId}/environment/${environmentId}/up?serviceId=${serviceId}`;
    const targetUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url }) : url;

    // Railway expects the raw tarball bytes with Content-Type: multipart/form-data
    // NOT wrapped in FormData
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: tarball,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to upload deployment to Railway: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
  }
}
