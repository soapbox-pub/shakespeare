import type { JSRuntimeFS } from '../JSRuntime';
import type { NostrSigner, NPool } from '@nostrify/nostrify';

export interface DeployOptions {
  /** Project ID */
  projectId: string;
  /** Path to the project directory */
  projectPath: string;
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
  fs: JSRuntimeFS;
  signer: NostrSigner;
  host?: string;
  subdomain?: string;
  corsProxy?: string;
}

export interface NetlifyDeployConfig {
  fs: JSRuntimeFS;
  apiKey: string;
  baseURL?: string;
  siteName?: string;
  siteId?: string;
  corsProxy?: string;
}

export interface VercelDeployConfig {
  fs: JSRuntimeFS;
  apiKey: string;
  baseURL?: string;
  teamId?: string;
  projectName?: string;
  corsProxy?: string;
}

export interface NsiteDeployConfig {
  fs: JSRuntimeFS;
  nostr: NPool;
  nsec: string;
  gateway: string;
  relayUrls: string[];
  blossomServers: string[];
}

export interface CloudflareDeployConfig {
  fs: JSRuntimeFS;
  apiKey: string;
  accountId: string;
  baseURL?: string;
  baseDomain?: string;
  projectName?: string;
  corsProxy?: string;
}

export interface DenoDeployConfig {
  fs: JSRuntimeFS;
  apiKey: string;
  organizationId: string;
  baseURL?: string;
  baseDomain?: string;
  projectName?: string;
  corsProxy?: string;
}

/** Build type for APK */
export type APKBuildType = 'debug' | 'release';

/** Keystore configuration for release builds */
export interface KeystoreConfig {
  /** Keystore data as base64 */
  keystoreBase64: string;
  /** Keystore password */
  keystorePassword: string;
  /** Key alias */
  keyAlias: string;
  /** Key password */
  keyPassword: string;
}

export interface APKBuilderDeployConfig {
  fs: JSRuntimeFS;
  /** URL of the APK build server */
  buildServerUrl: string;
  /** API key for the build server */
  apiKey: string;
  /** Display name of the Android app */
  appName: string;
  /** Android package ID (e.g., com.example.myapp) */
  packageId: string;
  /** Build type: debug (default) or release */
  buildType?: APKBuildType;
  /** Keystore configuration for release builds (browser-based signing) */
  keystoreConfig?: KeystoreConfig;
  /** Optional CORS proxy */
  corsProxy?: string;
  /** Optional progress callback */
  onProgress?: (status: {
    id: string;
    status: 'queued' | 'building' | 'complete' | 'failed' | 'cancelled';
    progress: number;
    error?: string;
    logs?: string[];
  }) => void;
}

export interface PresetDeployProvider {
  id: string;
  type: 'shakespeare' | 'netlify' | 'vercel' | 'nsite' | 'cloudflare' | 'deno' | 'apkbuilder';
  name: string;
  description: string;
  baseURL?: string;
  requiresNostr?: boolean;
  apiKeyLabel?: string;
  apiKeyURL?: string;
  accountIdLabel?: string;
  accountIdURL?: string;
  organizationIdLabel?: string;
  organizationIdURL?: string;
  buildServerUrlLabel?: string;
  proxy?: boolean;
}
