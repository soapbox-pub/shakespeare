import UriTemplate from 'uri-templates';
import { nip19 } from 'nostr-tools';
import { NostrURI } from './NostrURI';

export interface NgitWebUrlOpts {
  template: string;
  nostrURI: NostrURI;
}

/**
 * Generate a Nostr Git web URL from a template and Nostr URI
 * @param opts - Options object
 * @param opts.template - URL template with placeholders like {naddr}, {npub}, {pubkey}, {identifier}
 * @param opts.nostrURI - The Nostr URI containing pubkey, identifier, and optional relay
 * @returns The hydrated web URL
 */
export function ngitWebUrl(opts: NgitWebUrlOpts): string {
  const naddr = opts.nostrURI.toNaddr();
  const npub = nip19.npubEncode(opts.nostrURI.pubkey);

  return UriTemplate(opts.template).fill({
    naddr,
    npub,
    pubkey: opts.nostrURI.pubkey,
    identifier: opts.nostrURI.identifier,
  });
}
