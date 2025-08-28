import { HTTPError } from './HTTPError';
import { llmstxtUrl } from './llmstxt';

/** Options for configuring the NostrbookClient */
export interface NostrbookClientOpts {
  /** Base URL of the Nostrbook service */
  baseUrl: URL | string;
  /** Optional fetch function override */
  fetch?: typeof fetch;
}

/** Client for interacting with Nostrbook documentation */
export class NostrbookClient {
  /** Base URL of the Nostrbook service */
  readonly baseUrl: URL;

  /** The fetch implementation to use for requests */
  private fetch: typeof fetch;

  constructor(opts: NostrbookClientOpts) {
    this.baseUrl = new URL(opts.baseUrl);
    this.fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Fetches content from a specific path on the Nostrbook service */
  async get(path: string): Promise<string> {
    const url = llmstxtUrl(new URL(path, this.baseUrl));

    const request = new Request(url);
    const response = await this.fetch(request);

    if (!response.ok) {
      throw new HTTPError(response, request);
    }

    return response.text();
  }

  /** Reads documentation for a specific Nostr event kind */
  readKind(kind: number): Promise<string> {
    return this.get(`/kinds/${kind}`);
  }

  /** Reads documentation for a specific Nostr tag */
  readTag(tag: string): Promise<string> {
    return this.get(`/tags/${tag}`);
  }

  /** Reads documentation for a specific Nostr protocol document */
  readProtocol(doc: string): Promise<string> {
    return this.get(`/protocol/${doc}`);
  }
}