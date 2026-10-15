import type { NostrSigner } from '@nostrify/nostrify';
import mime from 'mime';
import { nip19 } from 'nostr-tools';
import type { JSRuntimeFS } from '../JSRuntime';
import type { DeployAdapter, DeployOptions, DeployProgress, DeployResult, NsiteDeployConfig } from './types';
import { buildNsiteUrl, toNsiteDTag } from '../utils/nsite';
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

/** Max concurrent HEAD checks per Blossom server — bodyless, so cheap to run wide */
const HEAD_CONCURRENCY = 8;

/**
 * How long the first upload auth waits for company (ms). HEAD checks finish in
 * bunches, and every hash that arrives in this window shares one signature.
 */
const AUTH_BATCH_WINDOW_MS = 50;

/** Minimum gap between upload progress reports (ms) */
const PROGRESS_INTERVAL_MS = 100;

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
 * Hands out BUD-02 auth headers on demand, signing them in batches.
 *
 * Only blobs some server is actually missing get signed for, so a redeploy
 * that changed two files costs one signature rather than one per twenty files.
 * Signing happens one batch at a time — a remote signer is the slowest thing in
 * the deploy, and uploads whose header is ready go ahead while the next batch
 * waits on it. Once the signer refuses, everything after is refused with the
 * same error rather than prompting again.
 */
class UploadAuthorizer {
  private tokens = new Map<string, Promise<string>>();
  private queue: { hash: string; resolve: (header: string) => void; reject: (err: unknown) => void }[] = [];

  /** Whether a signature is being waited on */
  busy = false;
  /** The signer's refusal, once there has been one */
  error?: unknown;

  constructor(
    private signer: NostrSigner,
    private onBusyChange: () => void,
    private signal?: AbortSignal,
  ) {}

  authorize(sha256: string): Promise<string> {
    let token = this.tokens.get(sha256);
    if (!token) {
      token = new Promise((resolve, reject) => this.queue.push({ hash: sha256, resolve, reject }));
      this.tokens.set(sha256, token);
      void this.drain();
    }
    return token;
  }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.onBusyChange();

    await new Promise(resolve => setTimeout(resolve, AUTH_BATCH_WINDOW_MS));

    while (this.queue.length) {
      const batch = this.queue.splice(0, UPLOAD_AUTH_BATCH_SIZE);
      try {
        if (this.error) throw this.error;
        this.signal?.throwIfAborted();
        const header = await createBatchUploadAuth(this.signer, batch.map(b => b.hash));
        for (const b of batch) b.resolve(header);
      } catch (err) {
        this.error ??= err;
        for (const b of batch) b.reject(err);
      }
    }

    this.busy = false;
    this.onBusyChange();
  }
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
async function blobExistsOnServer(serverBase: string, sha256: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const resp = await fetch(`${serverBase}/${sha256}`, {
      method: 'HEAD',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/** The result of one upload attempt, carrying the refusal when there was one. */
type UploadOutcome =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * PUT a single blob to a single Blossom server using a pre-signed auth header.
 *
 * XMLHttpRequest rather than fetch, because it is the only way a browser will
 * say how much of a request body has been sent, and that is what a progress
 * bar is made of.
 *
 * Reports why it failed rather than just that it did: a 413, a 401 and a
 * timeout are three different problems with three different answers, and a
 * bare boolean makes them indistinguishable to the person who has to fix it.
 */
function putBlob(
  serverBase: string,
  file: FileEntry,
  authHeader: string,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<UploadOutcome> {
  const timeout = uploadTimeoutMs(file.data.byteLength);

  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.onabort = () => resolve({ ok: false, reason: 'cancelled' });

    xhr.open('PUT', `${serverBase}/upload`);
    xhr.setRequestHeader('Authorization', authHeader);
    xhr.setRequestHeader('Content-Type', file.contentType);
    xhr.timeout = timeout;

    xhr.upload.onprogress = (event) => onProgress(event.loaded);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
        return;
      }

      // BUD-01 puts the refusal in X-Reason, and Blossom servers list it in
      // Access-Control-Expose-Headers precisely so a browser client can read
      // it. statusText is empty over HTTP/2, so it only gets appended when set.
      const detail = xhr.getResponseHeader('x-reason');
      const status = xhr.statusText
        ? `${xhr.status} ${xhr.statusText}`
        : String(xhr.status);

      resolve({ ok: false, reason: detail ? `${status} — ${detail}` : status });
    };

    xhr.ontimeout = () => {
      resolve({ ok: false, reason: `timed out after ${Math.round(timeout / 1000)}s` });
    };

    xhr.onerror = () => {
      resolve({ ok: false, reason: 'network error' });
    };

    xhr.send(new Blob([file.data], { type: file.contentType }));
  });
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
 * A gate that lets at most `concurrency` tasks run at once.
 */
function limiter(concurrency: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    while (active >= concurrency) {
      await new Promise<void>(resolve => waiting.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

/** One blob's way to being live, which is being on at least one server. */
interface BlobState {
  file: FileEntry;
  /** Servers that have not yet answered for this blob */
  pending: number;
  covered: boolean;
  /** Bytes each server has received so far, for uploads in flight */
  loaded: Map<string, number>;
}

/** Blobs no server took, and what each server said about them. */
interface UploadReport {
  uncovered: FileEntry[];
  failures: Map<string, { server: string; reason: string }[]>;
  /** The signer's refusal, if it refused */
  authError?: unknown;
}

/**
 * Put every blob on every server, resolving once each blob is on at least one.
 *
 * That is the moment the site can be published: the manifest lists every
 * server, and a gateway that misses on one tries the next. Waiting for every
 * server instead means waiting for the slowest one — and a server that is down
 * outright costs a full upload timeout per file before anything is published.
 * The remaining copies carry on in the background, and a later deploy fills in
 * any gaps, since it checks before it uploads.
 */
function uploadBlobs(
  blobs: FileEntry[],
  serverBases: string[],
  signer: NostrSigner,
  onProgress?: (progress: DeployProgress) => void,
  signal?: AbortSignal,
): Promise<UploadReport> {
  return new Promise((resolve, reject) => {
    const states = blobs.map((file): BlobState => ({
      file,
      pending: serverBases.length,
      covered: false,
      loaded: new Map(),
    }));

    const failures = new Map<string, { server: string; reason: string }[]>();
    const totalBytes = blobs.reduce((sum, b) => sum + b.data.byteLength, 0);

    let settled = 0;
    let coveredCount = 0;
    let coveredBytes = 0;
    let activePuts = 0;
    let finished = false;
    let lastReport = 0;

    const authorizer = new UploadAuthorizer(signer, () => report(true), signal);

    // A cancelled deploy stops where it is: in-flight PUTs are aborted, and
    // nothing not yet started gets signed for or sent.
    signal?.addEventListener('abort', () => {
      finished = true;
      reject(signal.reason);
    }, { once: true });

    const report = (force = false) => {
      if (finished || !onProgress) return;
      const now = Date.now();
      if (!force && now - lastReport < PROGRESS_INTERVAL_MS) return;
      lastReport = now;

      let sent = coveredBytes;
      for (const state of states) {
        if (!state.covered && state.loaded.size) {
          sent += Math.max(...state.loaded.values());
        }
      }

      let stage = 'Checking which files are already uploaded';
      if (activePuts > 0) stage = 'Uploading files';
      else if (authorizer.busy) stage = 'Waiting for your signer';

      onProgress({
        stage,
        fraction: totalBytes ? sent / totalBytes : 1,
        detail: `${coveredCount} of ${blobs.length} files · ${formatBytes(sent)} of ${formatBytes(totalBytes)}`,
      });
    };

    const answer = (state: BlobState, server: string, outcome: UploadOutcome) => {
      state.pending--;
      state.loaded.delete(server);

      if (outcome.ok) {
        if (!state.covered) {
          state.covered = true;
          coveredCount++;
          coveredBytes += state.file.data.byteLength;
          settled++;
        }
      } else {
        const reasons = failures.get(state.file.sha256) ?? [];
        reasons.push({ server, reason: outcome.reason });
        failures.set(state.file.sha256, reasons);
        if (state.pending === 0 && !state.covered) settled++;
      }

      if (settled === blobs.length && !finished) {
        report(true);
        finished = true;
        resolve({
          uncovered: states.filter(s => !s.covered).map(s => s.file),
          failures,
          authError: authorizer.error,
        });
      } else {
        report();
      }
    };

    report(true);

    for (const serverBase of serverBases) {
      const server = serverBase.replace(/^https?:\/\//, '');
      const head = limiter(HEAD_CONCURRENCY);
      const put = limiter(UPLOAD_CONCURRENCY);

      for (const state of states) {
        void (async () => {
          if (await head(() => blobExistsOnServer(serverBase, state.file.sha256, signal))) {
            answer(state, server, { ok: true });
            return;
          }
          if (signal?.aborted) return;

          let authHeader: string;
          try {
            authHeader = await authorizer.authorize(state.file.sha256);
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            answer(state, server, { ok: false, reason: `upload not authorized: ${reason}` });
            return;
          }

          const outcome = await put(async (): Promise<UploadOutcome> => {
            if (signal?.aborted) return { ok: false, reason: 'cancelled' };
            activePuts++;
            report(true);
            try {
              return await putBlob(serverBase, state.file, authHeader, (loaded) => {
                state.loaded.set(server, loaded);
                report();
              }, signal);
            } finally {
              activePuts--;
            }
          });

          answer(state, server, outcome);
        })();
      }
    }
  });
}

/**
 * Nsite Deploy Adapter — v2 implementation
 *
 * Deploys a built project as a Nostr static site using the nsite v2 spec:
 * - Uses the logged-in user's NostrSigner — no dedicated per-site keypair needed
 * - Pre-hashes all files with SHA-256 (Web Crypto API)
 * - HEAD-checks each blob on each Blossom server before uploading
 * - Signs batched BUD-02 kind-24242 auth tokens (up to 20 blobs per signing
 *   call), only for blobs some server is missing
 * - PUTs blobs to Blossom servers, publishing as soon as each is on one server
 *   while the other copies finish in the background
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
  private probeVanity: boolean;

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
    this.siteIdentifier = config.siteIdentifier ? toNsiteDTag(config.siteIdentifier) : undefined;
    this.probeVanity = config.probeVanity ?? true;
  }

  async deploy(options: DeployOptions): Promise<DeployResult> {
    const { projectPath, onProgress, signal } = options;
    const distPath = `${projectPath}/dist`;

    // Verify build output exists
    try {
      await this.fs.readFile(`${distPath}/index.html`, 'utf8');
    } catch {
      throw new Error('No index.html found in dist directory. Please build the project first.');
    }

    const pubkey = await this.signer.getPublicKey();
    const npub = nip19.npubEncode(pubkey);

    const serverBases = this.blossomServers.map(s => s.replace(/\/$/, ''));
    if (serverBases.length === 0) {
      throw new Error('No Blossom servers are configured to upload to.');
    }

    // ── Step 1: Walk dist/ and read + hash all files ──────────────────────────
    const files = await this.collectFiles(distPath, onProgress);

    if (files.length === 0) {
      throw new Error('No files found in dist directory.');
    }

    // ── Step 2: Upload each blob to every Blossom server ──────────────────────
    // Identical files are one blob, so each is uploaded once per server.
    // Upload auth is signed only for blobs some server lacks, in batches of up
    // to UPLOAD_AUTH_BATCH_SIZE hashes, while uploads already authorized run.
    const blobs = [...new Map(files.map(f => [f.sha256, f])).values()];
    signal?.throwIfAborted();
    const { uncovered, failures, authError } = await uploadBlobs(blobs, serverBases, this.signer, onProgress, signal);

    // Fail fast: any file unreachable on all servers means the deployed site
    // would serve broken responses for those paths — abort before publishing.
    if (uncovered.length > 0) {
      if (authError) throw authError;
      const missing = new Set(uncovered.map(f => f.sha256));
      throw new Error(describeUploadFailures(files.filter(f => missing.has(f.sha256)), failures));
    }

    // ── Step 3: Build the site manifest event ────────────────────────────────
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

    onProgress?.({ stage: 'Signing the site manifest' });

    const manifestEvent = await this.signer.signEvent({
      kind: manifestKind,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
      tags,
    });

    // The last point a cancel can take back: once a relay has the manifest,
    // the site is live.
    signal?.throwIfAborted();

    // ── Step 4: Publish manifest ──────────────────────────────────────────────
    // Blossom server hints are embedded as tags in the manifest itself —
    // no separate kind 10002 or kind 10063 events are published.
    //
    // Relay by relay, because the site is only as findable as the relays that
    // actually took it, and publishing to the group as a whole reports success
    // the moment one of them does — throwing away what the others said.
    onProgress?.({ stage: 'Publishing to relays', cancellable: false });
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
    if (isNamedSite && this.siteIdentifier && this.probeVanity) {
      onProgress?.({ stage: 'Checking the site address' });
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
   * Read every file under a directory in the VFS and compute its SHA-256.
   * Files are read in parallel and returned sorted by path.
   */
  private async collectFiles(
    distPath: string,
    onProgress?: (progress: DeployProgress) => void,
  ): Promise<FileEntry[]> {
    const paths: string[] = [];
    await this.walk(distPath, '', paths);
    paths.sort();

    onProgress?.({ stage: 'Reading files' });

    return Promise.all(paths.map(async (relPath) => {
      const fullPath = `${distPath}/${relPath}`;
      const raw = await this.fs.readFile(fullPath) as Uint8Array;
      // raw.slice() copies bytes into a new Uint8Array backed by a concrete ArrayBuffer,
      // avoiding the SharedArrayBuffer variant that Web Crypto and Blob refuse.
      const sliced = raw.slice();
      const data: ArrayBuffer = sliced.buffer as ArrayBuffer;
      const sha256 = await sha256Hex(sliced);
      const contentType = mime.getType(fullPath) || 'application/octet-stream';
      return { path: `/${relPath}`, data, sha256, contentType };
    }));
  }

  /** Collect the relative paths of every file under a directory. */
  private async walk(dirPath: string, relativePrefix: string, paths: string[]): Promise<void> {
    const entries = await this.fs.readdir(dirPath, { withFileTypes: true });

    await Promise.all(entries.map(async (entry) => {
      const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await this.walk(`${dirPath}/${entry.name}`, relPath, paths);
      } else if (entry.isFile()) {
        paths.push(relPath);
      }
    }));
  }
}
