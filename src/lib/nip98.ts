/**
 * NIP-98 HTTP Auth utilities
 * Creates signed events for HTTP authentication
 */
import type { NostrSigner, NostrEvent } from '@nostrify/nostrify';

/**
 * Create a NIP-98 auth event for HTTP requests
 */
export async function createNip98AuthEvent(
  signer: NostrSigner,
  url: string,
  method: string,
  payload?: string
): Promise<NostrEvent> {
  const tags: string[][] = [
    ['u', url],
    ['method', method.toUpperCase()],
  ];

  // Add payload hash if provided
  if (payload) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    tags.push(['payload', hashHex]);
  }

  const event = await signer.signEvent({
    kind: 27235,
    content: '',
    tags,
    created_at: Math.floor(Date.now() / 1000),
  });

  return event;
}

/**
 * Create Authorization header value from NIP-98 event
 */
export function createNip98AuthHeader(event: NostrEvent): string {
  const eventJson = JSON.stringify(event);
  const base64 = btoa(eventJson);
  return `Nostr ${base64}`;
}

/**
 * Perform a NIP-98 authenticated request
 */
export async function nip98Fetch(
  signer: NostrSigner,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method || 'GET';
  const body = options.body as string | undefined;

  const event = await createNip98AuthEvent(signer, url, method, body);
  const authHeader = createNip98AuthHeader(event);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': authHeader,
    },
  });
}

/**
 * Request an API key from a build server using NIP-98 auth
 */
export async function requestBuildServerApiKey(
  signer: NostrSigner,
  buildServerUrl: string,
  corsProxy?: string
): Promise<{ apiKey: string; pubkey: string; isNew: boolean }> {
  const authUrl = `${buildServerUrl.replace(/\/+$/, '')}/api/auth`;

  // Create the auth event
  const event = await createNip98AuthEvent(signer, authUrl, 'POST');
  const authHeader = createNip98AuthHeader(event);

  // Make the request (use CORS proxy if provided)
  const targetUrl = corsProxy
    ? `${corsProxy}/${authUrl.replace(/^https?:\/\//, '')}`
    : authUrl;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.apiKey) {
    throw new Error(data.error || 'Failed to get API key');
  }

  return {
    apiKey: data.apiKey,
    pubkey: data.pubkey,
    isNew: data.isNew,
  };
}
