import type { JSRuntimeFS } from '../JSRuntime';
import type { NostrSigner } from '@nostrify/nostrify';

export interface DeployOptions {
  /** Project ID */
  projectId: string;
  /** Filesystem instance containing the project */
  fs: JSRuntimeFS;
  /** Path to the project directory */
  projectPath: string;
  /** Project name */
  projectName?: string;
}

export interface DeployResult {
  /** The deployed URL */
  url: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface DeployAdapter {
  /** Deploy a project */
  deploy(options: DeployOptions): Promise<DeployResult>;
}

export interface ShakespeareDeployConfig {
  signer: NostrSigner;
  deployServer?: string;
  customHostname?: string;
  host?: string;
}

export interface NetlifyDeployConfig {
  apiKey: string;
  siteId?: string;
  siteName?: string;
  baseURL?: string;
}

export interface VercelDeployConfig {
  apiKey: string;
  projectId?: string;
  teamId?: string;
  projectName?: string;
  baseURL?: string;
}
