import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import { KindGenerator, type KindRange } from "../KindGenerator";
import { NIPsClient } from "../NIPsClient";

interface NostrGenerateKindParams {
  range: KindRange;
}

export class NostrGenerateKindTool implements Tool<NostrGenerateKindParams> {
  private nipsClient: NIPsClient;

  readonly description = "Generate an unused Nostr event kind number in the specified range";

  readonly inputSchema = z.object({
    range: z.enum(['regular', 'replaceable', 'ephemeral', 'addressable'])
      .describe(
        'Kind range: regular (1000-9999), replaceable (10000-19999), ephemeral (20000-29999), addressable (30000-39999)',
      ) as z.ZodType<KindRange>,
  });

  constructor() {
    this.nipsClient = new NIPsClient({
      urlTemplate: 'https://raw.githubusercontent.com/nostr-protocol/nips/refs/heads/master/{nip}.md',
    });
  }

  async execute(args: NostrGenerateKindParams): Promise<ToolResult> {
    const { range } = args;

    try {
      const nipsIndex = await this.nipsClient.readIndex();
      const usedKinds = KindGenerator.extractUsedKinds(nipsIndex);
      const availableKind = KindGenerator.generateAvailableKind(
        range,
        usedKinds,
      );

      const rangeInfo = KindGenerator.getKindRangeInfo(range);

      return {
        content: `Generated unused kind: ${availableKind}\n\nRange: ${rangeInfo.name} (${rangeInfo.min}-${rangeInfo.max})\nDescription: ${rangeInfo.description}\n\nThis kind number is currently not used by any official NIP.`
      };
    } catch (error) {
      throw new Error(`Error generating kind: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}