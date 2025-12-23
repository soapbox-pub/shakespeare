import UriTemplate from 'uri-templates';
import { nip19 } from 'nostr-tools';
import { NostrURI } from './NostrURI';

/**
 * Generate a Nostr Git web URL from a template and Nostr URI
 * @param template - URL template with placeholders like {naddr}, {npub}, {pubkey}, {identifier}
 * @param nostrURI - The Nostr URI containing pubkey, identifier, and optional relay
 * @returns The hydrated web URL
 */
export function ngitWebUrl(template: string, nostrURI: NostrURI): string {
  const naddr = nostrURI.toNaddr();
  const npub = nip19.npubEncode(nostrURI.pubkey);

  return UriTemplate(template).fill({
    naddr,
    npub,
    pubkey: nostrURI.pubkey,
    identifier: nostrURI.identifier,
  });
}
