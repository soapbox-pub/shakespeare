import { z } from "zod";

import type { Tool } from "./Tool";
import { NIPsClient } from "../NIPsClient";
import { HTTPError } from "../HTTPError";

interface NostrReadNipParams {
  nip: string;
}

export class NostrReadNipTool implements Tool<NostrReadNipParams> {
  private nipsClient: NIPsClient;

  readonly description = "Read a Nostr NIP document";

  readonly inputSchema = z.object({
    nip: z
      .string()
      .length(2)
      .regex(
        /^[0-9A-F]{2}$/,
        'NIP must be a 2-digit uppercase hex string, e.g. `01` or `C7`',
      )
      .describe('NIP to retrieve, e.g. `01` or `C7`'),
  });

  constructor() {
    this.nipsClient = new NIPsClient({
      urlTemplate: 'https://raw.githubusercontent.com/nostr-protocol/nips/refs/heads/master/{nip}.md',
    });
  }

  async execute(args: NostrReadNipParams): Promise<string> {
    const { nip } = args;

    try {
      const text = await this.nipsClient.readNip(nip);
      return text;
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(
          `NIP-${nip} does not exist in the official NIPs repository. Try using the \`nostr_read_nips_index\` tool to retrieve the full list of NIPs.`
        );
      }
      throw new Error(`Error reading NIP-${nip}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}