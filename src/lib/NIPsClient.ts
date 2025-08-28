import { HTTPError } from './HTTPError';

/** Options for configuring the NIPsClient */
export interface NIPsClientOpts {
  /** Template URL with {nip} placeholder that will be replaced with the NIP number */
  urlTemplate: string;
  /** Optional fetch function override */
  fetch?: typeof fetch;
}

/** Client for fetching NIPs (Nostr Implementation Possibilities) documentation */
export class NIPsClient {
  /** Template URL with {nip} placeholder */
  readonly urlTemplate: string;

  /** The fetch implementation to use for requests */
  private fetch: typeof fetch;

  constructor(opts: NIPsClientOpts) {
    this.urlTemplate = opts.urlTemplate;
    this.fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Reads a documentation file by its slug */
  async readDoc(slug: string): Promise<string> {
    const url = this.urlTemplate.replace('{nip}', slug);

    const request = new Request(url);
    const response = await this.fetch(request);

    if (!response.ok) {
      throw new HTTPError(response, request);
    }

    return response.text();
  }

  /** Reads a specific NIP document by its identifier */
  readNip(nip: string): Promise<string> {
    return this.readDoc(nip);
  }

  /** Reads the main index (README) document */
  readIndex(): Promise<string> {
    return this.readDoc('README');
  }

  /** Reads the breaking changes document */
  readBreaking(): Promise<string> {
    return this.readDoc('BREAKING');
  }
}