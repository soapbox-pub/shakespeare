import type { NostrEvent, NostrSigner } from '@nostrify/nostrify';

/**
 * A NIP-07 provider (`window.nostr` in a page, `self.nostr` in a service worker), with the additions
 * Din gives websites, nsites and their workers for clients that hold their accounts themselves
 * (Din's docs/window-nostr.md):
 *
 * - `requestPublicKey()` has the user give the site an account, and resolves with its key.
 * - `getSigner(pubkey)` resolves, without asking, with a signer pinned to an account the site holds,
 *   which switching the provider's own account doesn't change. It rejects with `NotFoundError` when
 *   the site doesn't hold it.
 */
export interface Nip07Provider extends NostrSigner {
  requestPublicKey?(): Promise<string>;
  getSigner?(pubkey: string): Promise<NostrSigner>;
}

/** The NIP-07 provider of this page or worker, if there is one. */
export function getNip07(): Nip07Provider | undefined {
  return (globalThis as { nostr?: Nip07Provider }).nostr;
}

/** Whether the provider can give and pin accounts (`requestPublicKey` and `getSigner`). */
export function holdsAccounts(provider: Nip07Provider | undefined): provider is Nip07Provider & Required<Pick<Nip07Provider, 'requestPublicKey' | 'getSigner'>> {
  return typeof provider?.requestPublicKey === 'function' && typeof provider.getSigner === 'function';
}

/**
 * The key of the account a NIP-07 login should be: one the user picks for the site where the
 * provider lets them (so a second extension login can be a second account), or its current one.
 */
export async function requestNip07PublicKey(): Promise<string> {
  const provider = getNip07();
  if (!provider) throw new Error('No NIP-07 signer is available');
  return holdsAccounts(provider) ? await provider.requestPublicKey() : await provider.getPublicKey();
}

/**
 * The NIP-07 signer for one account. Where the provider pins accounts, it signs with
 * `getSigner(pubkey)`, so it keeps acting as that account whichever account the provider is on.
 * Elsewhere it signs with the provider itself, as NIP-07 always has, or, given `fallback`, only
 * while the provider is on this account and with `fallback` otherwise (a service worker passes a
 * signer that asks a page).
 */
export class Nip07AccountSigner implements NostrSigner {
  private pinned?: Promise<NostrSigner>;

  constructor(private readonly pubkey: string, private readonly fallback?: NostrSigner) {}

  private async signer(): Promise<NostrSigner> {
    const provider = getNip07();
    if (holdsAccounts(provider)) {
      if (!this.pinned) {
        this.pinned = provider.getSigner(this.pubkey);
        // Asked again next time: the site may be given the account later.
        this.pinned.catch(() => { this.pinned = undefined; });
      }
      return await this.pinned;
    }
    if (!this.fallback) {
      if (!provider) throw new Error('No NIP-07 signer is available');
      return provider;
    }
    if (!provider) return this.fallback;
    const current = await provider.getPublicKey().catch(() => undefined);
    return current === this.pubkey ? provider : this.fallback;
  }

  getPublicKey(): Promise<string> {
    return Promise.resolve(this.pubkey);
  }

  async signEvent(event: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>): Promise<NostrEvent> {
    return await (await this.signer()).signEvent(event);
  }

  readonly nip04 = {
    encrypt: async (pubkey: string, plaintext: string) => (await this.cipher('nip04')).encrypt(pubkey, plaintext),
    decrypt: async (pubkey: string, ciphertext: string) => (await this.cipher('nip04')).decrypt(pubkey, ciphertext),
  };

  readonly nip44 = {
    encrypt: async (pubkey: string, plaintext: string) => (await this.cipher('nip44')).encrypt(pubkey, plaintext),
    decrypt: async (pubkey: string, ciphertext: string) => (await this.cipher('nip44')).decrypt(pubkey, ciphertext),
  };

  private async cipher(version: 'nip04' | 'nip44'): Promise<NonNullable<NostrSigner['nip04']>> {
    const signer = await this.signer();
    const cipher = signer[version] ?? this.fallback?.[version];
    if (!cipher) throw new Error(`This signer does not support ${version.toUpperCase()} encryption`);
    return cipher;
  }
}
