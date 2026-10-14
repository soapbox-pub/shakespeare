import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import { buildNsiteUrl, isValidDTag, toNsiteDTag } from '@/lib/utils/nsite';
import type { NpanelClaim, NpanelClaimManifest } from './npanelApi';

/** nsite named-site kind. Everything a gateway archived is one of these. */
export const NAMED_SITE_KIND = 35128;

/** nsite root-site kind. One per key, which is why one is never republished. */
export const ROOT_SITE_KIND = 15128;

/**
 * A gateway that serves any nsite from its address alone.
 *
 * Not this gateway, deliberately. Everything in this list is a decision about a
 * site somebody has not looked at in a year, and the honest way to show them one
 * is from an address rather than from the name that is in question — a name
 * about to be deleted, or one that no certificate covers and that has therefore
 * never loaded for anyone. It reads the same relays this provider publishes to,
 * so the archive's copy is as findable there as anywhere.
 */
const PREVIEW_GATEWAY = 'nsite.lol';

/**
 * Tags the archive wrote about itself, which are not the site's to carry.
 *
 * The title it invented was the hostname, because that was all it knew, and the
 * `alt` it wrote says the site is archived so that it keeps working — a true
 * sentence about the archive that stops being true the moment its owner takes
 * the name back.
 */
const ARCHIVE_TAGS = new Set(['title', 'description', 'alt']);

/**
 * What taking one name back requires.
 *
 * Three outcomes rather than two, because the interesting case is the one in
 * the middle: a name whose site is already published under the claimant's own
 * key needs no republishing at all, and republishing it anyway would overwrite
 * a live site with an old snapshot of itself.
 */
export type MigrationStep =
  /** Point the name at a site that already exists. Costs one request. */
  | { kind: 'claim'; address: string; reason: 'mine' | 'published' }
  /** Publish the archived manifest under the claimant's key, then point at it. */
  | { kind: 'republish'; identifier: string; manifest: NpanelClaimManifest }
  /** Nothing safe to do without a person deciding something first. */
  | { kind: 'blocked'; reason: string };

/** What a site calls itself, when it says. */
export interface SiteIdentity {
  title?: string | null;
  description?: string | null;
}

/** The `d` tag of a manifest, which for a named site is the site's identifier. */
export function manifestIdentifier(manifest: NpanelClaimManifest): string {
  return manifest.tags.find(([name]) => name === 'd')?.[1] ?? '';
}

/**
 * Whether a hostname is one label under the gateway's domain.
 *
 * The wildcard certificate a gateway serves covers exactly one label, so
 * `a.b.example.com` can be pointed at a site, claimed, and published for, and
 * will still fail its TLS handshake for everyone forever. The records exist
 * because the host this migration inherits from accepted them; there is no
 * point signing anything for one.
 */
export function isServableHostname(hostname: string, domain: string): boolean {
  const suffix = `.${domain.toLowerCase()}`;
  const name = hostname.toLowerCase();

  if (!name.endsWith(suffix)) return false;

  const label = name.slice(0, -suffix.length);
  return label.length > 0 && !label.includes('.');
}

/**
 * Somewhere the site at an address can actually be looked at.
 *
 * Preferred over the hostname because a preview is worth most for the names the
 * hostname cannot show: one too deep for a wildcard certificate, which answers a
 * TLS error and always has, and one about to be deleted, which will stop
 * answering at all. An address survives both.
 *
 * Undefined when the identifier is longer than a DNS label leaves room for —
 * about a quarter of what this migration carries, because the host it came from
 * named sites after projects and never had to fit one in a subdomain. There is
 * no address-based URL for those on any gateway, so callers fall back to the
 * hostname where the hostname works.
 */
export function nsitePreviewUrl(address: string | null | undefined): string | undefined {
  if (!address) return undefined;

  const [kind, pubkey, ...rest] = address.split(':');
  const identifier = rest.join(':');

  if (!/^[0-9a-f]{64}$/i.test(pubkey ?? '')) return undefined;

  if (Number(kind) === ROOT_SITE_KIND && !identifier) {
    return buildNsiteUrl({ pubkeyHex: pubkey, npub: nip19.npubEncode(pubkey), gateway: PREVIEW_GATEWAY });
  }

  if (Number(kind) === NAMED_SITE_KIND && isValidDTag(identifier)) {
    return buildNsiteUrl({
      pubkeyHex: pubkey,
      npub: nip19.npubEncode(pubkey),
      gateway: PREVIEW_GATEWAY,
      siteIdentifier: identifier,
    });
  }

  return undefined;
}

/**
 * Where to send somebody who wants to see a site before deciding about it.
 *
 * {@link nsitePreviewUrl} first, the hostname second, and nothing at all for a
 * name that is both unservable and unaddressable — which is a real combination
 * here, and better shown as no button than as a link to a certificate error.
 */
export function sitePreviewUrl(
  address: string | null | undefined,
  hostname: string,
  domain: string,
): string | undefined {
  return nsitePreviewUrl(address) ?? (isServableHostname(hostname, domain) ? `https://${hostname}` : undefined);
}

/**
 * Decide how a single waiting name gets back to its owner.
 *
 * `published` is the set of `d` tags the owner already publishes kind-35128
 * events under. It is what separates a name that only needs a record changed
 * from one that needs a site published, and getting it wrong in the careless
 * direction destroys a live site: kind 35128 is addressable, so a second event
 * at the same `d` tag replaces the first one everywhere.
 */
export function planClaim(
  claim: NpanelClaim,
  pubkey: string,
  published: ReadonlySet<string>,
  domain: string,
): MigrationStep {
  if (!isServableHostname(claim.hostname, domain)) {
    return {
      kind: 'blocked',
      reason: `No certificate covers a name this deep under ${domain}, so it can never load.`,
    };
  }

  // Already on their key — the site was never anyone else's, only the record
  // of who owns the name was missing.
  if (claim.mine && claim.address) {
    return { kind: 'claim', address: claim.address, reason: 'mine' };
  }

  if (!claim.manifest) {
    return {
      kind: 'blocked',
      reason: 'Nothing was archived under this name. Deploy a project to it to take it back.',
    };
  }

  // A root site is the one site a key can only have one of. Republishing an
  // archived copy as one would replace whatever the claimant's own key serves.
  if (claim.manifest.kind !== NAMED_SITE_KIND) {
    return {
      kind: 'blocked',
      reason: 'This name was archived as a root site, which would replace your main site if republished.',
    };
  }

  const identifier = manifestIdentifier(claim.manifest);
  if (!identifier) {
    return { kind: 'blocked', reason: 'The archived site has no name to publish it under.' };
  }

  // The archive named sites after projects, and a quarter of those names are
  // longer than NIP-5A lets a `d` tag be. Those are republished under a name
  // that fits; the hostname binding is what keeps the old name pointing at it.
  const dTag = toNsiteDTag(identifier);

  // The site is already theirs under this name; the hostname just needs to be
  // told about it. Both names then serve the same site, which is what someone
  // who deployed the same project twice was always asking for.
  for (const candidate of new Set([identifier, dTag])) {
    if (published.has(candidate)) {
      return {
        kind: 'claim',
        address: `${NAMED_SITE_KIND}:${pubkey}:${candidate}`,
        reason: 'published',
      };
    }
  }

  return { kind: 'republish', identifier: dTag, manifest: claim.manifest };
}

/**
 * The tags to sign to republish an archived site under one's own key.
 *
 * An nsite manifest is its tags — the paths and their hashes, and the Blossom
 * servers those hashes can be fetched from — so signing these again produces
 * the same site, file for file, under a different key. The blobs themselves are
 * addressed by hash and are already where the `server` tags say they are, so
 * nothing has to be uploaded.
 *
 * What is not carried over is the archive's own writing. It titled every site
 * after its hostname, which is an address wearing a name's clothes; the site's
 * real name, where it has one, is `identity`. A site that never said what it is
 * called gets no title, which is what an nsite manifest without one has always
 * meant and is more honest than a domain.
 *
 * The archive's relay hints are dropped and not replaced. NIP-5A gives a
 * manifest no tag for saying where it was published, so the archive's `relay`
 * and `r` tags are tags that were never part of the spec, and re-signing them
 * under someone else's key would only spread them further.
 */
export function republishTags(
  manifest: NpanelClaimManifest,
  identifier: string,
  identity: SiteIdentity = {},
): string[][] {
  const kept = manifest.tags.filter(
    ([name]) => name !== 'd' && name !== 'relay' && name !== 'r' && !ARCHIVE_TAGS.has(name),
  );

  return [
    // First, as an addressable event's `d` tag should be.
    ['d', identifier],
    ...kept,
    ...describeTags(identity),
  ];
}

/**
 * The same event, with the name the site chose in place of the one it was given.
 *
 * Built from the event as it stands rather than from anything the gateway
 * holds, because the two are not always the same thing: a site republished by
 * this migration and then redeployed normally has moved on, and rebuilding it
 * out of the gateway's copy would quietly restore an older version of the site.
 * Everything but the archive's own words and the relay hints NIP-5A never
 * defined is passed through untouched; signing an event is the moment to stop
 * carrying a tag that does not exist.
 */
export function retitleTags(event: NostrEvent, identity: SiteIdentity): string[][] {
  const kept = event.tags.filter(
    ([name]) => name !== 'relay' && name !== 'r' && !ARCHIVE_TAGS.has(name),
  );

  return [...kept, ...describeTags(identity)];
}

/**
 * Whether an event is still wearing the title the archive gave it.
 *
 * The archive had one thing to call a site it had only ever seen at an address,
 * so a title that is the hostname is a title nobody chose.
 */
export function hasArchiveTitle(event: NostrEvent, hostname: string): boolean {
  const title = event.tags.find(([name]) => name === 'title')?.[1];
  return typeof title === 'string' && title.toLowerCase() === hostname.toLowerCase();
}

/** `title` and `description` tags, for whichever of them the site supplied. */
function describeTags(identity: SiteIdentity): string[][] {
  const tags: string[][] = [];
  if (identity.title) tags.push(['title', identity.title]);
  if (identity.description) tags.push(['description', identity.description]);
  return tags;
}
