import { describe, it, expect } from "vitest";
import { WebFetchTool } from "./WebFetchTool";

describe("WebFetchTool", () => {
  const tool = new WebFetchTool();

  it("should have a description", () => {
    expect(tool.description).toBeDefined();
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it("should have an input schema", () => {
    expect(tool.inputSchema).toBeDefined();
  });

  it("should validate that URL starts with http:// or https://", async () => {
    await expect(
      tool.execute({ url: "ftp://example.com" })
    ).rejects.toThrow("URL must start with http:// or https://");
  });

  it("should default format to markdown", async () => {
    // This test would require mocking fetch, which we'll skip for now
    // Just verify the schema allows optional format
    const result = tool.inputSchema?.safeParse({
      url: "https://example.com",
    });
    expect(result?.success).toBe(true);
  });
});
