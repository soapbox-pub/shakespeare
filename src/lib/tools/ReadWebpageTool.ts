import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { z } from "zod";

import type { Tool } from "./Tool";

interface ReadWebpageParams {
  url: string;
}

export class ReadWebpageTool implements Tool<ReadWebpageParams> {
  private domParser: DOMParser;
  private turndownService: TurndownService;

  readonly description = "Read and extract the main content from a webpage, converting it to markdown";

  readonly inputSchema = z.object({
    url: z.string().url().describe(
      "The URL of the webpage to read and extract content from"
    ),
  });

  constructor(domParser: DOMParser) {
    this.domParser = domParser;
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      fence: "```",
      emDelimiter: "*",
      strongDelimiter: "**",
      linkStyle: "inlined",
      linkReferenceStyle: "full",
    });

    // Configure turndown to preserve code blocks and improve formatting
    this.turndownService.addRule("preserveCodeBlocks", {
      filter: ["pre"],
      replacement: (content, node) => {
        const codeElement = node.querySelector("code");
        if (codeElement) {
          const language = codeElement.className.match(/language-(\w+)/)?.[1] || "";
          return `\n\n\`\`\`${language}\n${codeElement.textContent || content}\n\`\`\`\n\n`;
        }
        return `\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
      },
    });

    // Improve table handling
    this.turndownService.addRule("tables", {
      filter: "table",
      replacement: (content) => {
        return `\n\n${content}\n\n`;
      },
    });
  }

  async execute(args: ReadWebpageParams): Promise<string> {
    const { url } = args;

    try {
      // Validate URL format
      new URL(url);

      // Fetch the webpage
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        throw new Error(`Expected HTML content, but received: ${contentType}`);
      }

      const html = await response.text();

      // Parse the HTML
      const doc = this.domParser.parseFromString(html, "text/html");

      // Use Readability to extract the main content
      const reader = new Readability(doc, {
        debug: false,
        maxElemsToParse: 0, // No limit
        nbTopCandidates: 5,
        charThreshold: 500,
        classesToPreserve: ["highlight", "code", "pre"],
      });

      const article = reader.parse();

      if (!article) {
        throw new Error("Could not extract readable content from the webpage");
      }

      // Convert the extracted HTML content to markdown
      const markdown = this.turndownService.turndown(article.content || "");

      // Create a formatted result with metadata
      const result = [
        `# ${article.title || "Untitled"}`,
        "",
        article.excerpt ? `${article.excerpt}` : "",
        article.excerpt ? "" : "",
        `**Source:** ${url}`,
        article.byline ? `**Author:** ${article.byline}` : "",
        article.publishedTime ? `**Published:** ${article.publishedTime}` : "",
        "",
        "---",
        "",
        markdown,
      ].filter(Boolean).join("\n");

      return result;

    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(`Network error: Unable to fetch ${url}. ${error.message}`);
      }
      throw new Error(`Failed to read webpage ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}