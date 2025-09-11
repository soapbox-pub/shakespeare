import type { Tool } from "./Tool";
import { NIPsClient } from "../NIPsClient";

export class NostrReadNipsIndexTool implements Tool<void> {
  private nipsClient: NIPsClient;

  readonly description = "Read the full list of NIPs, kinds, and tags";

  constructor() {
    this.nipsClient = new NIPsClient({
      urlTemplate: 'https://raw.githubusercontent.com/nostr-protocol/nips/refs/heads/master/{nip}.md',
    });
  }

  async execute(): Promise<string> {
    try {
      const text = await this.nipsClient.readIndex();
      return text;
    } catch (error) {
      throw new Error(`Error reading NIPs index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}