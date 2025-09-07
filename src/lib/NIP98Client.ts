import { NostrSigner, NIP98 } from "@nostrify/nostrify";
import { N64 } from "@nostrify/nostrify/utils";

export class NIP98Client {
  constructor(private signer: NostrSigner) {}

  async fetch(input: string | URL | Request, init?: RequestInit) {
    const request = new Request(input, init);
    const template = await NIP98.template(request);
    const event = await this.signer.signEvent(template);
    const token = N64.encodeEvent(event);
    request.headers.set("Authorization", `Nostr ${token}`);
    return fetch(request);
  }
}