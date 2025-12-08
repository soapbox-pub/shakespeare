import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import { ReadWebpageTool } from "./ReadWebpageTool";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ReadWebpageTool", () => {
  let tool: ReadWebpageTool;
  let domParser: DOMParser;

  beforeEach(() => {
    // Create a JSDOM instance for testing
    const jsdom = new JSDOM();
    domParser = new jsdom.window.DOMParser();
    tool = new ReadWebpageTool(domParser);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("inputSchema", () => {
    it("should validate valid URL", () => {
      const result = tool.inputSchema.safeParse({
        url: "https://example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const result = tool.inputSchema.safeParse({
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("execute", () => {
    it("should extract and convert article content to markdown", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Article</title>
        </head>
        <body>
          <article>
            <h1>Main Article Title</h1>
            <p>This is the main content of the article.</p>
            <p>It has multiple paragraphs with <strong>bold text</strong> and <em>italic text</em>.</p>
            <h2>Subsection</h2>
            <ul>
              <li>First item</li>
              <li>Second item</li>
            </ul>
          </article>
          <div class="sidebar">
            <p>This is sidebar content that should be ignored.</p>
          </div>
        </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/html; charset=utf-8"),
        },
        text: vi.fn().mockResolvedValue(mockHtml),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await tool.execute({
        url: "https://example.com/article",
      });

      expect(result.content).toContain("# Test Article");
      expect(result.content).toContain("**Source:** https://example.com/article");
      expect(result.content).toContain("Main Article Title");
      expect(result.content).toContain("**bold text**");
      expect(result.content).toContain("*italic text*");
      expect(result.content).toContain("## Subsection");
      expect(result.content).toContain("*   First item");
      expect(result.content).toContain("*   Second item");
    });

    it("should handle articles with metadata", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Article with Metadata</title>
          <meta name="author" content="John Doe">
          <meta name="description" content="This is a test article description">
        </head>
        <body>
          <article>
            <header>
              <h1>Article with Metadata</h1>
              <p class="byline">By John Doe</p>
              <time datetime="2023-01-01">January 1, 2023</time>
            </header>
            <p>Main article content goes here.</p>
          </article>
        </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/html"),
        },
        text: vi.fn().mockResolvedValue(mockHtml),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await tool.execute({
        url: "https://example.com/article-with-metadata",
      });

      expect(result.content).toContain("# Article with Metadata");
      expect(result.content).toContain("**Source:** https://example.com/article-with-metadata");
    });

    it("should handle code blocks properly", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <article>
            <h1>Code Example</h1>
            <p>Here's some code:</p>
            <pre><code class="language-javascript">
function hello() {
  console.log("Hello, world!");
}
            </code></pre>
            <p>And some inline <code>code</code> too.</p>
          </article>
        </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/html"),
        },
        text: vi.fn().mockResolvedValue(mockHtml),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await tool.execute({
        url: "https://example.com/code-example",
      });

      expect(result.content).toContain("```");
      expect(result.content).toContain("function hello()");
      expect(result.content).toContain("`code`");
    });

    it("should handle HTTP errors", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(tool.execute({
        url: "https://example.com/not-found",
      })).rejects.toThrow("HTTP 404: Not Found");
    });

    it("should handle non-HTML content", async () => {
      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("application/json"),
        },
        text: vi.fn().mockResolvedValue('{"data": "json"}'),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(tool.execute({
        url: "https://api.example.com/data.json",
      })).rejects.toThrow("Expected HTML content, but received: application/json");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

      await expect(tool.execute({
        url: "https://example.com",
      })).rejects.toThrow("Network error: Unable to fetch https://example.com");
    });

    it("should handle pages with minimal content", async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="navigation">Nav content</div>
          <div class="footer">Footer content</div>
        </body>
        </html>
      `;

      const mockResponse = {
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue("text/html"),
        },
        text: vi.fn().mockResolvedValue(mockHtml),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await tool.execute({
        url: "https://example.com/minimal-content",
      });

      expect(result.content).toContain("# Untitled");
      expect(result.content).toContain("**Source:** https://example.com/minimal-content");
    });

    it("should handle invalid URLs", async () => {
      await expect(tool.execute({
        url: "invalid-url",
      })).rejects.toThrow("Failed to read webpage invalid-url");
    });
  });
});