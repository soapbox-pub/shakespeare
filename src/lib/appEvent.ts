import git from 'isomorphic-git';
import { DotAI } from './DotAI';
import { NostrURI } from './NostrURI';
import { readNsiteVfsConfig } from './nsiteConfig';
import { toNsiteDTag } from './utils/nsite';
import type { JSRuntimeFS } from './JSRuntime';

/** Input for building a kind 31990 app event. */
export interface AppEventInput {
  name: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  dTag: string;
  tTags?: string[];
  supportedKinds?: string[];
  webHandlers?: Array<{ url: string; type?: string }>;
  /** Explicit "a" tag value for the ngit repo (kind:pubkey:identifier). Overrides auto-detection from git remote. */
  ngitRepo?: string;
  /** Explicit "a" tag value for the nsite deployment (kind:pubkey:identifier). Overrides auto-detection from .nsite/config.json. */
  nsiteDeployment?: string;
}

/** The content and tags for a kind 31990 event, ready to be signed/published. */
export interface AppEventData {
  content: string;
  tags: string[][];
}

/**
 * Build the content JSON and tags array for a kind 31990 app event.
 *
 * Optionally inspects the project's git origin remote. If it's a `nostr://`
 * URI owned by the given pubkey, an `a` tag referencing the kind 30617 repo
 * event is included.
 */
export async function buildAppEvent(
  input: AppEventInput,
  opts?: {
    fs?: JSRuntimeFS;
    cwd?: string;
    pubkey?: string;
  },
): Promise<AppEventData> {
  // Build content (kind-0-style metadata JSON)
  const content: Record<string, string> = {};
  if (input.name.trim()) content.name = input.name.trim();
  if (input.about?.trim()) content.about = input.about.trim();
  if (input.picture?.trim()) content.picture = input.picture.trim();
  if (input.banner?.trim()) content.banner = input.banner.trim();
  if (input.website?.trim()) content.website = input.website.trim();

  // Build tags
  const tags: string[][] = [
    ['d', input.dTag.trim()],
  ];

  // Add k tags for supported kinds
  if (input.supportedKinds) {
    for (const kind of input.supportedKinds) {
      tags.push(['k', kind]);
    }
  }

  // Add web handler tags
  if (input.webHandlers) {
    for (const handler of input.webHandlers) {
      if (handler.url) {
        const webTag = ['web', handler.url];
        if (handler.type) {
          webTag.push(handler.type);
        }
        tags.push(webTag);
      }
    }
  }

  // Add user-defined t-tags
  if (input.tTags) {
    for (const tag of input.tTags) {
      if (tag.trim()) tags.push(['t', tag.trim()]);
    }
  }

  // Add t-tags for categorization (shakespeare + template name), skipping duplicates
  if (opts?.fs && opts.cwd) {
    const existingTTags = new Set(input.tTags?.map(t => t.trim().toLowerCase()) ?? []);
    if (!existingTTags.has('shakespeare')) {
      tags.push(['t', 'shakespeare']);
    }
    try {
      const dotAI = new DotAI(opts.fs, opts.cwd);
      const template = await dotAI.readTemplate();
      if (template && !existingTTags.has(template.name.toLowerCase())) {
        tags.push(['t', template.name.toLowerCase()]);
      }
    } catch {
      // Template not found, skip
    }
  }

  // Add "a" tag for the ngit repo — use explicit override if provided, otherwise auto-detect from git remote
  if (input.ngitRepo?.trim()) {
    tags.push(['a', input.ngitRepo.trim()]);
  } else if (opts?.fs && opts.cwd && opts.pubkey) {
    try {
      const remotes = await git.listRemotes({ fs: opts.fs, dir: opts.cwd });
      const originUrl = remotes.find(r => r.remote === 'origin')?.url;
      if (originUrl?.startsWith('nostr://')) {
        const nostrURI = await NostrURI.parse(originUrl);
        if (nostrURI.pubkey === opts.pubkey) {
          tags.push(['a', `30617:${nostrURI.pubkey}:${nostrURI.identifier}`]);
        }
      }
    } catch {
      // No remote or parse error, skip
    }
  }

  // Add "a" tag for the nsite deployment — use explicit override if provided, otherwise auto-detect from .nsite/config.json
  if (input.nsiteDeployment?.trim()) {
    tags.push(['a', input.nsiteDeployment.trim()]);
  } else if (opts?.fs && opts.cwd && opts.pubkey) {
    try {
      const nsiteConfig = await readNsiteVfsConfig(opts.fs, opts.cwd);
      if (nsiteConfig?.id) {
        tags.push(['a', `35128:${opts.pubkey}:${toNsiteDTag(nsiteConfig.id)}`]);
      }
    } catch {
      // No nsite config found, skip
    }
  }

  return {
    content: JSON.stringify(content),
    tags,
  };
}
