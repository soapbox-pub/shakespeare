/**
 * Utilities for the nsite v2 deployment spec.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Max length of a valid nsite dTag — must fit as a DNS label component */
const DTAG_MAX_LENGTH = 13;

/**
 * Valid nsite dTag pattern:
 *  - 1–13 lowercase alphanumeric characters or hyphens
 *  - Must start and end with an alphanumeric character (valid DNS label)
 *  - No consecutive hyphens
 *
 * Examples: "myblog", "my-blog", "site-2"
 */
const DTAG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Convert a project name into a valid nsite dTag identifier.
 *
 * Strategy:
 *  1. Lowercase, replace spaces/underscores/dots with hyphens, strip everything else.
 *  2. Collapse consecutive hyphens, strip leading/trailing hyphens.
 *  3. If the result is 1–13 chars and valid → use it directly.
 *  4. If too long → truncate to 13, then strip any trailing hyphens.
 *  5. If the result is empty (name had no alphanumeric content) →
 *     SHA-256 hash the original name and take the first 13 hex digits.
 *     This is fully deterministic: the same project name always produces the same dTag.
 *
 * The hash fallback produces lowercase hex (`[0-9a-f]`), which satisfies the dTag rules.
 */
export async function projectNameToDTag(name: string): Promise<string> {
  const slug = name
    .toLowerCase()
    .replace(/[\s_./]+/g, '-')   // spaces, underscores, dots → hyphens
    .replace(/[^a-z0-9-]/g, '')  // strip everything else
    .replace(/-{2,}/g, '-')      // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')     // strip leading/trailing hyphens
    .slice(0, DTAG_MAX_LENGTH)
    .replace(/-+$/g, '');        // re-strip trailing hyphens after truncation

  if (slug.length >= 1) {
    return slug;
  }

  // Name had no usable alphanumeric content — hash for a short, stable identifier
  const encoded = new TextEncoder().encode(name);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, DTAG_MAX_LENGTH);
}

/**
 * Validate that a string is an acceptable nsite dTag.
 *  - 1–13 characters
 *  - Lowercase alphanumeric and hyphens only
 *  - Must start and end with an alphanumeric character (valid DNS label)
 */
export function isValidDTag(value: string): boolean {
  return value.length >= 1 && value.length <= DTAG_MAX_LENGTH && DTAG_REGEX.test(value);
}

/**
 * Fit an arbitrary site identifier into a NIP-5A named-site `d` tag.
 *
 * Valid identifiers pass through unchanged, so existing sites keep their
 * address. Anything else — an npanel subdomain, an archived manifest named
 * after a project, a hand-edited `.nsite/config.json` — is slugified and
 * truncated, with a short hash of the original appended. Plain truncation
 * would let two long names that share a prefix land on the same `d` tag, and
 * kind 35128 is addressable: deploying one would replace the other.
 */
export function toNsiteDTag(identifier: string): string {
  if (isValidDTag(identifier)) return identifier;

  const hash = bytesToHex(sha256(utf8ToBytes(identifier))).slice(0, 4);
  const head = identifier
    .toLowerCase()
    .replace(/[\s_./]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, DTAG_MAX_LENGTH - hash.length - 1)
    .replace(/-+$/, '');

  return head ? `${head}-${hash}` : hash;
}

/**
 * Encode a 32-byte pubkey (as hex string) into a 50-character lowercase base36 string.
 * Used to build named-site subdomain URLs: `{base36pubkey}{dTag}.{gateway}`
 *
 * Ported from nsite.run/apps/spa/src/lib/base36.js
 */
export function pubkeyToBase36(pubkeyHex: string): string {
  // hex → Uint8Array
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(pubkeyHex.slice(i * 2, i * 2 + 2), 16);
  }

  const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
  const BASE = 36n;

  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }

  const digits: string[] = [];
  while (value > 0n) {
    digits.push(ALPHABET[Number(value % BASE)]);
    value = value / BASE;
  }

  return digits.reverse().join('').padStart(50, '0');
}

/**
 * Build the deployed URL for an nsite.
 *
 * - Named site (kind 35128): `https://{base36pubkey}{dTag}.{gateway}`
 * - Root site  (kind 15128): `https://{npub}.{gateway}`
 */
export function buildNsiteUrl(opts: {
  pubkeyHex: string;
  npub: string;
  gateway: string;
  siteIdentifier?: string;
}): string {
  const { pubkeyHex, npub, gateway, siteIdentifier } = opts;
  if (siteIdentifier) {
    const base36 = pubkeyToBase36(pubkeyHex);
    return `https://${base36}${siteIdentifier}.${gateway}`;
  }
  return `https://${npub}.${gateway}`;
}
