import { z } from "zod";

import type { Tool } from "./Tool";
import { NostrbookClient } from "../NostrbookClient";

interface NostrReadProtocolParams {
  doc: 'index' | 'event' | 'filter' | 'client' | 'relay';
}

export class NostrReadProtocolTool implements Tool<NostrReadProtocolParams> {
  private nostrbookClient: NostrbookClient;

  readonly description = "Read Nostr protocol basics";

  readonly inputSchema = z.object({
    doc: z.enum(['index', 'event', 'filter', 'client', 'relay']),
  });

  constructor() {
    this.nostrbookClient = new NostrbookClient({
      baseUrl: 'https://nostrbook.dev',
    });
  }

  async execute(args: NostrReadProtocolParams): Promise<string> {
    const { doc } = args;

    try {
      const text = await this.nostrbookClient.readProtocol(doc);
      return text;
    } catch (error) {
      throw new Error(`Error reading protocol doc "${doc}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}