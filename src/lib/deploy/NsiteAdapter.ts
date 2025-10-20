import { BlossomUploader } from '@nostrify/nostrify/uploaders';
import { NSecSigner, NPool } from '@nostrify/nostrify';
import type { NostrEvent } from '@nostrify/nostrify';
import mime from 'mime';
import { nip19 } from 'nostr-tools';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, NsiteDeployConfig } from './types';

/**
 * Nsite Deploy Adapter
 * Deploys static sites to Nostr using kind 34128 events and Blossom file storage
 */
export class NsiteAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private nostr: NsiteDeployConfig['nostr'];
  private nsec: string;
  private gateway: string;
  private relayUrls: string[];
  private blossomServers: string[];

  constructor(config: NsiteDeployConfig) {
    this.fs = config.fs;
    this.nostr = config.nostr;
    this.nsec = config.nsec;
    this.gateway = config.gateway;
    this.relayUrls = config.relayUrls;
    this.blossomServers = config.blossomServers;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectPath } = options;

    // Check if dist directory exists and contains index.html
    const distPath = `${projectPath}/dist`;
    try {
      await this.fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    // Decode nsec to get the private key and create signer
    const decoded = nip19.decode(this.nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    const signer = new NSecSigner(decoded.data);
    const pubkey = await signer.getPublicKey();

    // Create a grouped Nostr client for the configured relays
    const relayClient = this.nostr.group(this.relayUrls);

    // Initialize Blossom uploader
    const uploader = new BlossomUploader({
      servers: this.blossomServers,
      signer,
    });

    // Collect all files and upload them
    const fileEvents: NostrEvent[] = [];
    await this.uploadDirectory(distPath, '', uploader, signer, fileEvents);

    // Publish file events and other metadata to the relays
    await Promise.all([
      this.publishRelayList(signer, relayClient),
      this.publishServerList(signer, relayClient),
      ...fileEvents.map(event => relayClient.event(event, { signal: AbortSignal.timeout(5000) })),
    ]);

    // Generate npub subdomain
    const npub = nip19.npubEncode(pubkey);
    const siteUrl = `https://${npub}.${this.gateway}`;

    return {
      url: siteUrl,
      metadata: {
        pubkey,
        npub,
        filesPublished: fileEvents.length,
        provider: 'nsite',
      },
    };
  }

  private async uploadDirectory(
    dirPath: string,
    relativePath: string,
    uploader: BlossomUploader,
    signer: NSecSigner,
    fileEvents: NostrEvent[]
  ): Promise<void> {
    const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await this.uploadDirectory(fullPath, relPath, uploader, signer, fileEvents);
      } else if (entry.isFile()) {
        await this.uploadFile(fullPath, relPath, uploader, signer, fileEvents);
      }
    }
  }

  private async uploadFile(
    filePath: string,
    relativePath: string,
    uploader: BlossomUploader,
    signer: NSecSigner,
    fileEvents: NostrEvent[]
  ): Promise<void> {
    try {
      // Read file content
      const content = await this.fs.readFile(filePath);

      // Convert to File object for upload
      const file = new File([content], relativePath.split('/').pop() || 'file', {
        type: mime.getType(filePath) || undefined,
      });

      // Upload to Blossom and get tags
      const tags = await uploader.upload(file);

      // Extract sha256 hash from tags
      // Tags format: [['url', 'https://...'], ['x', 'sha256hash'], ['size', '1234'], ...]
      const xTag = tags.find(([name]) => name === 'x');
      if (!xTag || !xTag[1]) {
        throw new Error(`Failed to get sha256 hash for ${relativePath}`);
      }
      const sha256 = xTag[1];

      // Create absolute path (must start with /)
      const absolutePath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

      // Create kind 34128 event
      const event = await signer.signEvent({
        kind: 34128,
        content: '',
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', absolutePath],
          ['x', sha256],
        ],
      });

      fileEvents.push(event);
    } catch (error) {
      console.warn(`Failed to upload file ${filePath}:`, error);
      throw error;
    }
  }

  private async publishRelayList(signer: NSecSigner, relayClient: NPool): Promise<void> {
    const relayListEvent = await signer.signEvent({
      kind: 10002,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
      tags: this.relayUrls.map(url => ['r', url]),
    });

    await relayClient.event(relayListEvent, { signal: AbortSignal.timeout(5000) });
  }

  private async publishServerList(signer: NSecSigner, relayClient: NPool): Promise<void> {
    const serverListEvent = await signer.signEvent({
      kind: 10063,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
      tags: this.blossomServers.map(server => ['server', server]),
    });

    await relayClient.event(serverListEvent, { signal: AbortSignal.timeout(5000) });
  }
}
