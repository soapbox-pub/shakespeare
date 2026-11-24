import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';
import type { NostrConnectParams } from '@nostrify/react/login';
import { requestNip07PublicKey } from '@/lib/nip07';

// NOTE: This file should not be edited except for adding new login methods.

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    // Login with a Nostr secret key
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
    },
    // Login with a NIP-46 "bunker://" URI
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
    },
    // Login via client-initiated NIP-46 ("nostrconnect://" QR code).
    // Caller generates params with `generateNostrConnectParams`, renders the
    // URI as a QR/deep-link, and awaits this promise — it resolves when the
    // remote signer connects back over the relay.
    async nostrconnect(params: NostrConnectParams, signal?: AbortSignal): Promise<void> {
      const login = await NLogin.fromNostrConnect(params, nostr, { signal });
      addLogin(login);
    },
    // Login with a NIP-07 browser extension. Where it lets a site hold accounts (Din's
    // requestPublicKey), the user picks the account, so each extension login can be another.
    async extension(): Promise<void> {
      const login = new NLogin('extension', await requestNip07PublicKey(), null);
      addLogin(login);
    },
    // Log out the current user
    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        removeLogin(login.id);
      }
    }
  };
}
