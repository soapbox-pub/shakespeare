import { z } from "zod";

import type { Tool } from "./Tool";
import { NostrbookClient } from "../NostrbookClient";
import { HTTPError } from "../HTTPError";

interface NostrReadKindParams {
  kind: number;
}

export class NostrReadKindTool implements Tool<NostrReadKindParams> {
  private nostrbookClient: NostrbookClient;

  readonly description = "Read Nostr documentation about a specific event kind";

  readonly inputSchema = z.object({
    kind: z.number().describe('Kind number to retrieve, e.g. `1` or `42`'),
  });

  constructor() {
    this.nostrbookClient = new NostrbookClient({
      baseUrl: 'https://nostrbook.dev',
    });
  }

  async execute(args: NostrReadKindParams): Promise<string> {
    const { kind } = args;

    try {
      const text = await this.nostrbookClient.readKind(kind);
      return text;
    } catch (error) {
      if (error instanceof HTTPError && error.response.status === 404) {
        throw new Error(
          `No documentation found for kind ${kind}. Try using the \`nostr_read_nips_index\` tool to see if it's specified by a NIP.`
        );
      }
      throw new Error(`Error reading kind ${kind}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}