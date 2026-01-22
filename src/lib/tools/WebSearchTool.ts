import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";

interface WebSearchParams {
  query: string;
  numResults?: number;
  livecrawl?: "fallback" | "preferred";
  type?: "auto" | "fast" | "deep";
  contextMaxCharacters?: number;
}

interface WebSearchToolOptions {
  baseUrl?: string;
  searchEndpoint?: string;
  defaultNumResults?: number;
  timeout?: number;
}

interface McpSearchRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      numResults?: number;
      livecrawl?: "fallback" | "preferred";
      type?: "auto" | "fast" | "deep";
      contextMaxCharacters?: number;
    };
  };
}

interface McpSearchResponse {
  jsonrpc: string;
  result: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
}

export class WebSearchTool implements Tool<WebSearchParams> {
  private readonly baseUrl: string;
  private readonly searchEndpoint: string;
  private readonly defaultNumResults: number;
  private readonly timeout: number;

  readonly description = `- Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs
- Provides up-to-date information for current events and recent data
- Supports configurable result counts and returns the content from the most relevant websites
- Use this tool for accessing information beyond knowledge cutoff
- Searches are performed automatically within a single API call

Usage notes:
  - Supports live crawling modes: 'fallback' (backup if cached unavailable) or 'preferred' (prioritize live crawling)
  - Search types: 'auto' (balanced), 'fast' (quick results), 'deep' (comprehensive search)
  - Configurable context length for optimal LLM integration
  - Domain filtering and advanced search options available`;

  readonly inputSchema = z.object({
    query: z.string().describe("Websearch query"),
    numResults: z.number().optional().describe("Number of search results to return (default: 8)"),
    livecrawl: z
      .enum(["fallback", "preferred"])
      .optional()
      .describe(
        "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')"
      ),
    type: z
      .enum(["auto", "fast", "deep"])
      .optional()
      .describe("Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search"),
    contextMaxCharacters: z
      .number()
      .optional()
      .describe("Maximum characters for context string optimized for LLMs (default: 10000)"),
  });

  constructor(options: WebSearchToolOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://mcp.exa.ai";
    this.searchEndpoint = options.searchEndpoint ?? "/mcp";
    this.defaultNumResults = options.defaultNumResults ?? 8;
    this.timeout = options.timeout ?? 25000;
  }

  async execute(args: WebSearchParams): Promise<ToolResult> {
    const searchRequest: McpSearchRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query: args.query,
          type: args.type || "auto",
          numResults: args.numResults || this.defaultNumResults,
          livecrawl: args.livecrawl || "fallback",
          contextMaxCharacters: args.contextMaxCharacters,
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      };

      const response = await fetch(`${this.baseUrl}${this.searchEndpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(searchRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search error (${response.status}): ${errorText}`);
      }

      const responseText = await response.text();

      // Parse SSE response
      const lines = responseText.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data: McpSearchResponse = JSON.parse(line.substring(6));
          if (data.result && data.result.content && data.result.content.length > 0) {
            return {
              content: data.result.content[0].text,
            };
          }
        }
      }

      return {
        content: "No search results found. Please try a different query.",
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Search request timed out");
      }

      throw error;
    }
  }
}
