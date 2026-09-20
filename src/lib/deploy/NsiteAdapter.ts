import type { NostrSigner } from '@nostrify/nostrify';
import mime from 'mime';
import { nip19 } from 'nostr-tools';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployResult, NsiteDeployConfig } from './types';
import { buildNsiteUrl } from '../utils/nsite';
import { publishToRelays } from './publishToRelays';

/** nsite v2 root-site kind (replaceable by pubkey+kind) */
const NSITE_ROOT_SITE_KIND = 15128;

/** nsite v2 named-site kind (addressable by pubkey+kind+d) */
const NSITE_NAMED_SITE_KIND = 35128;

/** BUD-02 Blossom authorization event kind */
const BLOSSOM_AUTH_KIND = 24242;

/** Max number of sha256 hashes covered by one batch auth event */
const UPLOAD_AUTH_BATCH_SIZE = 20;

/** Max concurrent uploads per Blossom server */
const UPLOAD_CONCURRENCY = 4;

/** Timeout for bodyless probe requests — HEAD checks and gateway probes (ms) */
const FETCH_TIMEOUT_MS = 15_000;

/** Connection setup and server-side processing, independent of payload size (ms) */
const UPLOAD_BASE_TIMEOUT_MS = 30_000;

/**
 * Slowest sustained throughput an upload is allowed to run at before it is
 * abandoned (bytes/sec).
 *
 * Deliberately forgiving, because uploads do not get the link to themselves:
 * every configured server uploads concurrently and each runs
 * UPLOAD_CONCURRENCY files at once, so with the three default servers a single
 * request may be sharing the uplink with eleven others.
 */
const UPLOAD_MIN_THROUGHPUT_BPS = 32 * 1024; // 256 kbps

/** How many failed files get spelled out before the error message summarises */
const MAX_REPORTED_FAILURES = 3;

/**
 * The time budget for uploading a blob of the given size.
 *
 * A fixed deadline applied to a multi-megabyte body is a bandwidth test rather
 * than a timeout: it fails the largest files first, on exactly the connections
 * that most needed the time. Scaling the budget to the payload means what gets
 * enforced is a floor on throughput, which is the thing actually worth
 * enforcing.
 */
function uploadTimeoutMs(byteLength: number): number {
  return UPLOAD_BASE_TIMEOUT_MS + (byteLength / UPLOAD_MIN_THROUGHPUT_BPS) * 1000;
}

/** Render a byte count the way a person reads one. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

interface FileEntry {
  /** Absolute path in the manifest, e.g. "/index.html" */
  path: string;
  /** Raw file bytes as a concrete ArrayBuffer (for Web Crypto + File constructor compatibility) */
  data: ArrayBuffer;
  /** Lower-case hex SHA-256 of data */
  sha256: string;
  /** MIME type */
  contentType: string;
}

/**
 * Encode an ArrayBuffer / Uint8Array as a lower-case hex string.
 */
function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute the SHA-256 of a Uint8Array and return the hex digest.
 * The Uint8Array must already be backed by a concrete ArrayBuffer
 * (use raw.slice() before calling this to ensure no SharedArrayBuffer).
 */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return encodeHex(new Uint8Array(buf));
}

/**
 * Build a BUD-02 kind-24242 upload-auth event template covering multiple blobs.
 * The signed event is base64-encoded and returned as the full Authorization header value.
 */
async function createBatchUploadAuth(
  signer: NostrSigner,
  sha256Hashes: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const template = {
    kind: BLOSSOM_AUTH_KIND,
    created_at: now,
    tags: [
      ['t', 'upload'],
      ...sha256Hashes.map(h => ['x', h]),
      ['expiration', String(now + 3600)],
    ],
    content: 'Upload blobs',
  };
  const signed = await signer.signEvent(template);
  return `Nostr ${btoa(JSON.stringify(signed))}`;
}

/**
 * Vanity subdomain name rules from VANITY.md:
 *  - 1–49 characters long
 *  - lowercase letters, digits, and hyphens only
 *  - cannot start or end with a hyphen
 */
const VANITY_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,47}[a-z0-9])?$/;

const VANITY_RESERVED_NAMES = new Set([
  'www', 'api', 'status', 'admin', 'mail', 'smtp', 'imap', 'pop', 'ftp',
  'ns1', 'ns2', 'ns3', 'ns4', 'localhost', 'autoconfig', 'autodiscover', '_dmarc',
]);

/**
 * Check whether a site identifier qualifies as a valid vanity name candidate.
 * This is a client-side pre-check — the gateway is the source of truth.
 */
function isVanityCandidate(name: string): boolean {
  return (
    name.length >= 1 &&
    name.length <= 49 &&
    VANITY_NAME_REGEX.test(name) &&
    !VANITY_RESERVED_NAMES.has(name)
  );
}

/**
 * After a named-site deploy, probe the gateway to see if a vanity subdomain was
 * assigned. Not all gateways support vanity subdomains, so this is best-effort.
 *
 * Returns the vanity URL (e.g. "https://ditto.shakespeare.wtf") if the gateway
 * confirms the vanity name belongs to this pubkey, or `undefined` otherwise.
 */
async function probeVanityUrl(
  gateway: string,
  siteIdentifier: string,
  pubkey: string,
): Promise<string | undefined> {
  // Quick client-side guard — skip the network request if the name is obviously invalid
  if (!isVanityCandidate(siteIdentifier)) {
    return undefined;
  }

  const vanityOrigin = `https://${siteIdentifier}.${gateway}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(`${vanityOrigin}/`, {
        method: 'HEAD',
        signal: controller.signal,
      });

      // Check for the X-Nsite-* headers that indicate vanity support
      const nsitePubkey = resp.headers.get('x-nsite-pubkey');
      const nsiteName = resp.headers.get('x-nsite-name');

      // Vanity name is confirmed when the gateway returns the name header
      // AND the pubkey matches ours (i.e. we own this vanity name).
      if (nsiteName && nsitePubkey === pubkey) {
        return vanityOrigin;
      }

      // If the response is a 404 with X-Nsite-Available: true, the name hasn't
      // been reserved yet. It will likely be claimed once the gateway processes
      // our manifest, but we can't confirm it right now — return undefined and
      // let the next deploy pick it up.
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Network error, gateway doesn't support vanity, CORS blocked, etc.
    return undefined;
  }
}

/**
 * Check whether a blob already exists on a Blossom server.
 * Returns true if the server responds 2xx to a HEAD request.
 */
async function blobExistsOnServer(serverBase: string, sha256: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(`${serverBase}/${sha256}`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      return resp.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** The result of one upload attempt, carrying the refusal when there was one. */
type UploadOutcome =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Upload a single file to a single Blossom server using a pre-signed auth header.
 * Skips the upload if the blob already exists on the server.
 *
 * Reports why it failed rather than just that it did: a 413, a 401 and a
 * timeout are three different problems with three different answers, and a
 * bare boolean makes them indistinguishable to the person who has to fix it.
 */
async function uploadToServer(
  serverBase: string,
  file: FileEntry,
  authHeader: string,
): Promise<UploadOutcome> {
  // Skip if already present
  if (await blobExistsOnServer(serverBase, file.sha256)) {
    return { ok: true };
  }

  const blob = new File([file.data], file.path.split('/').pop() || 'file', {
    type: file.contentType,
  });

  const timeout = uploadTimeoutMs(file.data.byteLength);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(`${serverBase}/upload`, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': file.contentType,
        },
        body: blob,
        signal: controller.signal,
      });

      if (resp.ok) {
        return { ok: true };
      }

      // BUD-01 puts the refusal in X-Reason, and Blossom servers list it in
      // Access-Control-Expose-Headers precisely so a browser client can read
      // it. statusText is empty over HTTP/2, so it only gets appended when set.
      const detail = resp.headers.get('x-reason');
      const status = resp.statusText
        ? `${resp.status} ${resp.statusText}`
        : String(resp.status);

      return { ok: false, reason: detail ? `${status} — ${detail}` : status };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, reason: `timed out after ${Math.round(timeout / 1000)}s` };
    }
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Compose the error for files that reached no server at all.
 *
 * Sizes are included because size is what separates these files from the ones
 * that uploaded fine, and because a 413 only means something next to the
 * number that provoked it.
 */
function describeUploadFailures(
  failedFiles: FileEntry[],
  failures: Map<string, { server: string; reason: string }[]>,
): string {
  const lines = failedFiles.slice(0, MAX_REPORTED_FAILURES).map(file => {
    const reasons = failures.get(file.sha256) ?? [];
    const detail = reasons.length
      ? reasons.map(r => `${r.server} — ${r.reason}`).join('; ')
      : 'no server was reached';

    return `${file.path} (${formatBytes(file.data.byteLength)}): ${detail}`;
  });

  const remaining = failedFiles.length - lines.length;
  if (remaining > 0) {
    lines.push(`…and ${remaining} more`);
  }

  return [
    `Failed to upload ${failedFiles.length} file(s) to any Blossom server.`,
    ...lines,
  ].join('\n');
}

/**
 * Run an async task queue with a fixed concurrency limit.
 */
async function runConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
}

/**
 * Nsite Deploy Adapter — v2 implementation
 *
 * Deploys a built project as a Nostr static site using the nsite v2 spec:
 * - Uses the logged-in user's NostrSigner — no dedicated per-site keypair needed
 * - Pre-hashes all files with SHA-256 (Web Crypto API)
 * - Signs batched BUD-02 kind-24242 auth tokens (20 files per signing call)
 * - HEAD-checks each file on each Blossom server before uploading
 * - PUTs files to Blossom servers with pre-signed auth headers
 * - Publishes a single kind-15128 (root) or kind-35128 (named) site manifest event
 *   containing all ["path", "/path", sha256] tags and ["server", url] Blossom
 *   hints — no separate kind 10002 or kind 10063 published
 *
 * Named sites (kind 35128, siteIdentifier set):
 *   URL = https://{base36pubkey}{siteIdentifier}.{gateway}
 * Root sites (kind 15128, no siteIdentifier):
 *   URL = https://{npub}.{gateway}
 */
export class NsiteAdapter implements DeployAdapter {
  private fs: JSRuntimeFS;
  private nostr: NsiteDeployConfig['nostr'];
  private signer: NostrSigner;
  private gateway: string;
  private relayUrls: string[];
  private blossomServers: string[];
  private siteTitle?: string;
  private siteDescription?: string;
  private sourceUrl?: string;
  private siteIdentifier?: string;

  constructor(config: NsiteDeployConfig) {
    this.fs = config.fs;
    this.nostr = config.nostr;
    this.signer = config.signer;
    this.gateway = config.gateway;
    this.relayUrls = config.relayUrls;
    this.blossomServers = config.blossomServers;
    this.siteTitle = config.siteTitle;
    this.siteDescription = config.siteDescription;
    this.sourceUrl = config.sourceUrl;
    this.siteIdentifier = config.siteIdentifier;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectPath } = options;
    const distPath = `${projectPath}/dist`;

    // Verify build output exists
    try {
      await this.fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    const pubkey = await this.signer.getPublicKey();
    const npub = nip19.npubEncode(pubkey);

    // ── Step 1: Walk dist/ and read + hash all files ──────────────────────────
    const files: FileEntry[] = [];
    await this.collectFiles(distPath, '', files);

    if (files.length === 0) {
      throw new Error('No files found in dist directory.');
    }

    // ── Step 2: Pre-sign batched BUD-02 auth tokens ───────────────────────────
    // One kind-24242 event covers up to UPLOAD_AUTH_BATCH_SIZE sha256 hashes,
    // dramatically reducing signer calls when using remote signers/bunkers.
    const authTokenMap = new Map<string, string>();
    for (let i = 0; i < files.length; i += UPLOAD_AUTH_BATCH_SIZE) {
      const batch = files.slice(i, i + UPLOAD_AUTH_BATCH_SIZE);
      const hashes = batch.map(f => f.sha256);
      const authHeader = await createBatchUploadAuth(this.signer, hashes);
      for (const hash of hashes) {
        authTokenMap.set(hash, authHeader);
      }
    }

    // ── Step 3: Upload files to each Blossom server ───────────────────────────
    // All servers upload concurrently; within each server, files are uploaded
    // with limited concurrency to avoid overwhelming the server.
    // Track which files land on at least one server — a file missing from every
    // server means the manifest would point to an unreachable blob.
    const serverBases = this.blossomServers.map(s => s.replace(/\/$/, ''));

    // uploadedSha256s: set of sha256 hashes confirmed present on ≥1 server
    const uploadedSha256s = new Set<string>();

    // Why each server refused a blob, kept for the files that fail everywhere.
    // A refusal from one server is not itself a problem — another may take it —
    // so these are only worth reporting once no server has taken the file.
    const failures = new Map<string, { server: string; reason: string }[]>();

    await Promise.all(
      serverBases.map(serverBase =>
        runConcurrent(files, UPLOAD_CONCURRENCY, async (file) => {
          const authHeader = authTokenMap.get(file.sha256);
          if (!authHeader) return;
          const result = await uploadToServer(serverBase, file, authHeader);
          if (result.ok) {
            uploadedSha256s.add(file.sha256);
          } else {
            const reasons = failures.get(file.sha256) ?? [];
            reasons.push({
              server: serverBase.replace(/^https?:\/\//, ''),
              reason: result.reason,
            });
            failures.set(file.sha256, reasons);
          }
        }),
      ),
    );

    // Fail fast: any file unreachable on all servers means the deployed site
    // would serve broken responses for those paths — abort before publishing.
    const failedFiles = files.filter(f => !uploadedSha256s.has(f.sha256));
    if (failedFiles.length > 0) {
      throw new Error(describeUploadFailures(failedFiles, failures));
    }

    // ── Step 4: Build the site manifest event ────────────────────────────────
    // kind 35128 for named sites (has siteIdentifier / d tag)
    // kind 15128 for root site (no d tag)
    const isNamedSite = Boolean(this.siteIdentifier);
    const manifestKind = isNamedSite ? NSITE_NAMED_SITE_KIND : NSITE_ROOT_SITE_KIND;

    const pathTags: string[][] = files.map(f => ['path', f.path, f.sha256]);

    // SPA fallback: map /404.html to the same blob as /index.html so that
    // React Router (and other SPAs) work correctly — the nsite host server
    // serves /404.html when a path is not found, acting as a client-side router fallback.
    const indexFile = files.find(f => f.path === '/index.html');
    if (indexFile && !files.some(f => f.path === '/404.html')) {
      pathTags.push(['path', '/404.html', indexFile.sha256]);
    }

    // NIP-5A defines no relay-hint tag for a manifest, so the relays a site was
    // published to are not written into it. Where to find the event is the
    // reader's problem and the author's kind 10002, not the manifest's.
    const serverTags: string[][] = serverBases.map(url => ['server', url]);

    const tags: string[][] = [];

    // d tag must come first for addressable events (kind 35128)
    if (isNamedSite && this.siteIdentifier) {
      tags.push(['d', this.siteIdentifier]);
    }

    tags.push(...pathTags, ...serverTags);

    if (this.siteTitle) {
      tags.push(['title', this.siteTitle]);
    }

    if (this.siteDescription) {
      tags.push(['description', this.siteDescription]);
    }

    if (this.sourceUrl) {
      tags.push(['source', this.sourceUrl]);
    }

    const manifestEvent = await this.signer.signEvent({
      kind: manifestKind,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
      tags,
    });

    // ── Step 5: Publish manifest ──────────────────────────────────────────────
    // Blossom server hints are embedded as tags in the manifest itself —
    // no separate kind 10002 or kind 10063 events are published.
    //
    // Relay by relay, because the site is only as findable as the relays that
    // actually took it, and publishing to the group as a whole reports success
    // the moment one of them does — throwing away what the others said.
    const publish = await publishToRelays(this.nostr, manifestEvent, this.relayUrls);

    // Build the canonical deployed URL (always the long-form base36 or npub URL)
    const siteUrl = buildNsiteUrl({
      pubkeyHex: pubkey,
      npub,
      gateway: this.gateway,
      siteIdentifier: this.siteIdentifier,
    });

    // For named sites, probe whether the gateway assigned a vanity subdomain.
    // This is best-effort — if the gateway doesn't support vanity, we just
    // return the canonical URL and move on.
    let vanityUrl: string | undefined;
    if (isNamedSite && this.siteIdentifier) {
      vanityUrl = await probeVanityUrl(this.gateway, this.siteIdentifier, pubkey);
    }

    return {
      // Prefer the short vanity URL when confirmed by the gateway
      url: vanityUrl ?? siteUrl,
      metadata: {
        pubkey,
        npub,
        filesPublished: files.length,
        provider: 'nsite',
        siteIdentifier: this.siteIdentifier,
        manifestKind,
        vanityUrl,
        canonicalUrl: siteUrl,
        eventId: manifestEvent.id,
        relaysAccepted: publish.accepted,
        relaysRejected: publish.rejected,
      },
    };
  }

  /**
   * Recursively walk a directory in the VFS, reading every file and computing its SHA-256.
   * Populates the provided `files` array with fully resolved FileEntry objects.
   */
  private async collectFiles(
    dirPath: string,
    relativePrefix: string,
    files: FileEntry[],
  ): Promise<void> {
    const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await this.collectFiles(fullPath, relPath, files);
      } else if (entry.isFile()) {
        const raw = await this.fs.readFile(fullPath) as Uint8Array;
        // raw.slice() copies bytes into a new Uint8Array backed by a concrete ArrayBuffer,
        // avoiding the SharedArrayBuffer variant that Web Crypto and File refuse.
        const sliced = raw.slice();
        const data: ArrayBuffer = sliced.buffer as ArrayBuffer;
        const sha256 = await sha256Hex(sliced);
        const absolutePath = `/${relPath}`;
        const contentType = mime.getType(fullPath) || 'application/octet-stream';

        files.push({ path: absolutePath, data, sha256, contentType });
      }
    }
  }
}
