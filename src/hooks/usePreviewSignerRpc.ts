/**
 * JSON-RPC handler that proxies NIP-07 calls from the preview iframe to the
 * logged-in user's signer.
 *
 * The preview runs whatever code the project contains, which may have been
 * imported from anywhere, so every operation except `getPublicKey` is gated
 * by a permission prompt. Only one prompt is shown at a time; requests that
 * arrive while one is open are rejected.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  getPreviewPermission,
  setPreviewPermission,
  type PreviewPermissionScope,
  type PreviewPermissionType,
} from '@/lib/previewPermissions';

/** A permission prompt waiting for the user's decision. */
export interface PreviewPromptState {
  /** Unique per request, so the prompt UI resets between requests. */
  id: number;
  type: PreviewPermissionType;
  /** For signEvent: the event kind. */
  kind: number | null;
  /** For signEvent on kind 30078: the record's `d` tag. */
  dTag: string | null;
  /** For signEvent: the unsigned event template. */
  event?: Record<string, unknown>;
  /** For decrypt: whether the data is encrypted to the user's own key. */
  self?: boolean;
  /** Whether the decision may be remembered for this project. */
  rememberable: boolean;
}

export interface PreviewPromptDecision {
  allowed: boolean;
  remember: boolean;
}

type PromptRequest = Omit<PreviewPromptState, 'id'>;

interface PromptResolver {
  resolve: (decision: PreviewPromptDecision) => void;
  reject: (err: Error) => void;
}

function getDTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string[] => Array.isArray(t) && t[0] === 'd')
    .map((t) => (typeof t[1] === 'string' ? t[1] : ''));
}

export function usePreviewSignerRpc(projectId: string) {
  const { user } = useCurrentUser();
  const [pendingPrompt, setPendingPrompt] = useState<PreviewPromptState | null>(null);

  const promptResolverRef = useRef<PromptResolver | null>(null);
  const promptIdRef = useRef(0);

  // Reject a prompt left open when the project or account changes, so it
  // can't be answered on behalf of another project or account.
  useEffect(() => {
    return () => {
      promptResolverRef.current?.reject(new Error('User rejected'));
      promptResolverRef.current = null;
      setPendingPrompt(null);
    };
  }, [projectId, user?.pubkey]);

  /**
   * Show a prompt and wait for the decision. A request arriving while a
   * prompt is open is rejected: replacing the prompt would let the page swap
   * in a different request just before the user clicks Allow.
   */
  const showPrompt = useCallback((request: PromptRequest): Promise<PreviewPromptDecision> => {
    return new Promise((resolve, reject) => {
      if (promptResolverRef.current) {
        reject(new Error('Another permission request is pending'));
        return;
      }
      promptResolverRef.current = { resolve, reject };
      setPendingPrompt({ ...request, id: ++promptIdRef.current });
    });
  }, []);

  const resolvePrompt = useCallback((decision: PreviewPromptDecision) => {
    promptResolverRef.current?.resolve(decision);
    promptResolverRef.current = null;
    setPendingPrompt(null);
  }, []);

  const checkPermission = useCallback(async (request: PromptRequest): Promise<void> => {
    if (!user) throw new Error('Not logged in');

    const scope: PreviewPermissionScope = { type: request.type, kind: request.kind, dTag: request.dTag };

    if (request.rememberable) {
      const stored = getPreviewPermission(projectId, user.pubkey, scope);
      if (stored === 'allow') return;
      if (stored === 'deny') throw new Error('User rejected');
    }

    const decision = await showPrompt(request);

    if (request.rememberable && decision.remember) {
      setPreviewPermission(projectId, user.pubkey, scope, decision.allowed);
    }

    if (!decision.allowed) {
      throw new Error('User rejected');
    }
  }, [projectId, user, showPrompt]);

  const onRpc = useCallback(async (method: string, params: unknown): Promise<unknown> => {
    if (!user) throw new Error('Not logged in');

    const { signer } = user;
    const p = (params ?? {}) as Record<string, unknown>;

    switch (method) {
      case 'nostr.getPublicKey':
        return user.pubkey;

      case 'nostr.signEvent': {
        const event = p.event as Record<string, unknown> | undefined;
        if (!event || typeof event.kind !== 'number') {
          throw new Error('Invalid event');
        }
        const kind = event.kind;

        let dTag: string | null = null;
        if (kind === 30078) {
          // Relays match `#d` filters against every `d` tag, so a second one
          // would let a grant for one record overwrite another.
          const dTags = getDTags(event.tags);
          if (dTags.length > 1) {
            throw new Error('Events with more than one d tag are not allowed');
          }
          dTag = dTags[0] ?? '';
        }

        await checkPermission({ type: 'signEvent', kind, dTag, event, rememberable: true });

        return await signer.signEvent({
          kind,
          content: typeof event.content === 'string' ? event.content : '',
          tags: Array.isArray(event.tags) ? event.tags as NostrEvent['tags'] : [],
          created_at: typeof event.created_at === 'number' ? event.created_at : Math.floor(Date.now() / 1000),
        });
      }

      case 'nostr.nip04.encrypt':
      case 'nostr.nip44.encrypt': {
        const type = method === 'nostr.nip04.encrypt' ? 'nip04.encrypt' : 'nip44.encrypt';
        const crypto = type === 'nip04.encrypt' ? signer.nip04 : signer.nip44;
        if (!crypto) throw new Error(`Signer does not support ${type === 'nip04.encrypt' ? 'NIP-04' : 'NIP-44'}`);

        const { pubkey, plaintext } = p;
        if (typeof pubkey !== 'string' || !pubkey || typeof plaintext !== 'string') {
          throw new Error('Invalid params');
        }

        await checkPermission({ type, kind: null, dTag: null, rememberable: true });
        return await crypto.encrypt(pubkey, plaintext);
      }

      case 'nostr.nip04.decrypt':
      case 'nostr.nip44.decrypt': {
        const type = method === 'nostr.nip04.decrypt' ? 'nip04.decrypt' : 'nip44.decrypt';
        const crypto = type === 'nip04.decrypt' ? signer.nip04 : signer.nip44;
        if (!crypto) throw new Error(`Signer does not support ${type === 'nip04.decrypt' ? 'NIP-04' : 'NIP-44'}`);

        const { pubkey, ciphertext } = p;
        if (typeof pubkey !== 'string' || !pubkey || typeof ciphertext !== 'string') {
          throw new Error('Invalid params');
        }

        // Data encrypted to the user's own key holds private lists, app
        // settings and wallet backups from other apps, so it is asked about
        // every time.
        const self = pubkey.toLowerCase() === user.pubkey;
        await checkPermission({ type, kind: null, dTag: null, self, rememberable: !self });
        return await crypto.decrypt(pubkey, ciphertext);
      }

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }, [user, checkPermission]);

  return { onRpc, pendingPrompt, resolvePrompt };
}
