import { z } from "zod";

import type { Tool } from "./Tool";
import { NostrbookClient } from "../NostrbookClient";
import { HTTPError } from "../HTTPError";

interface NostrReadTagParams {
  tag: string;
}

export class NostrReadTagTool implements Tool<NostrReadTagParams> {
  private nostrbookClient: NostrbookClient;

  readonly description = "Read Nostr documentation about a specific tag";

  readonly inputSchema = z.object({
    tag: z.string().describe('Tag name to retrieve, e.g. `p` or `e`'),
  });

  constructor() {
    this.nostrbookClient = new NostrbookClient({
      baseUrl: 'https://nostrbook.dev',
    });
  }

  async execute(args: NostrReadTagParams): Promise<string> {
    const { tag } = args;

    try {
      const text = await this.nostrbookClient.readTag(tag);
      return text;
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(
          `No documentation found for the "${tag}" tag. Try using the \`nostr_read_nips_index\` tool to see if it's specified by a NIP.`
        );
      }
      throw new Error(`Error reading tag "${tag}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}