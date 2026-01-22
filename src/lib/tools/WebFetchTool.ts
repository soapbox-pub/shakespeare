import TurndownService from "turndown";
import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import { proxyUrl } from "../proxyUrl";

interface WebFetchParams {
  url: string;
  format?: "text" | "markdown" | "html";
  timeout?: number;
}

interface WebFetchToolOptions {
  maxResponseSize?: number;
  defaultTimeout?: number;
  maxTimeout?: number;
  corsProxy?: string;
}

export class WebFetchTool implements Tool<WebFetchParams> {
  private readonly maxResponseSize: number;
  private readonly defaultTimeout: number;
  private readonly maxTimeout: number;
  private readonly corsProxy?: string;

  readonly description = `- Fetches content from a specified URL
- Takes a URL and optional format as input
- Fetches the URL content, converts to requested format (markdown by default)
- Returns the content in the specified format
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: if another tool is present that offers better web fetching capabilities, is more targeted to the task, or has fewer restrictions, prefer using that tool instead of this one.
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - Format options: "markdown" (default), "text", or "html"
  - This tool is read-only and does not modify any files
  - Results may be summarized if the content is very large`;

  readonly inputSchema = z.object({
    url: z.string().url().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .default("markdown")
      .describe("The format to return the content in (text, markdown, or html). Defaults to markdown."),
    timeout: z.number().optional().describe("Optional timeout in seconds (max 120)"),
  });

  constructor(options: WebFetchToolOptions = {}) {
    this.maxResponseSize = options.maxResponseSize ?? 5 * 1024 * 1024; // 5MB
    this.defaultTimeout = options.defaultTimeout ?? 30 * 1000; // 30 seconds
    this.maxTimeout = options.maxTimeout ?? 120 * 1000; // 2 minutes
    this.corsProxy = options.corsProxy;
  }

  async execute(args: WebFetchParams): Promise<ToolResult> {
    // Validate URL
    if (!args.url.startsWith("http://") && !args.url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://");
    }

    const timeout = Math.min((args.timeout ?? this.defaultTimeout / 1000) * 1000, this.maxTimeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Build Accept header based on requested format with q parameters for fallbacks
      const format = args.format || "markdown";
      let acceptHeader = "*/*";
      switch (format) {
        case "markdown":
          acceptHeader = "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
          break;
        case "text":
          acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
          break;
        case "html":
          acceptHeader = "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
          break;
        default:
          acceptHeader =
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
      }

      // Use CORS proxy if provided
      const fetchUrl = this.corsProxy ? proxyUrl({ template: this.corsProxy, url: args.url }) : args.url;

      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
          Accept: acceptHeader,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Request failed with status code: ${response.status}`);
      }

      // Check content length
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > this.maxResponseSize) {
        throw new Error(`Response too large (exceeds ${this.maxResponseSize / (1024 * 1024)}MB limit)`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > this.maxResponseSize) {
        throw new Error(`Response too large (exceeds ${this.maxResponseSize / (1024 * 1024)}MB limit)`);
      }

      const content = new TextDecoder().decode(arrayBuffer);
      const contentType = response.headers.get("content-type") || "";

      // Handle content based on requested format and actual content type
      let output: string;
      switch (format) {
        case "markdown":
          if (contentType.includes("text/html")) {
            output = this.convertHTMLToMarkdown(content);
          } else {
            output = content;
          }
          break;

        case "text":
          if (contentType.includes("text/html")) {
            output = this.extractTextFromHTML(content);
          } else {
            output = content;
          }
          break;

        case "html":
          output = content;
          break;

        default:
          output = content;
      }

      return { content: output };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out");
      }

      throw new Error(`Failed to fetch webpage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private extractTextFromHTML(html: string): string {
    // Create a temporary DOM element to extract text
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove script, style, and other non-content elements
    const elementsToRemove = doc.querySelectorAll("script, style, noscript, iframe, object, embed");
    elementsToRemove.forEach(el => el.remove());

    // Get text content
    return (doc.body?.textContent || "").trim();
  }

  private convertHTMLToMarkdown(html: string): string {
    const turndownService = new TurndownService({
      headingStyle: "atx",
      hr: "---",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
    });
    turndownService.remove(["script", "style", "meta", "link"]);
    return turndownService.turndown(html);
  }
}
