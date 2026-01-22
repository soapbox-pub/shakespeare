import { describe, it, expect } from "vitest";
import { WebSearchTool } from "./WebSearchTool";

describe("WebSearchTool", () => {
  const tool = new WebSearchTool();

  it("should have a description", () => {
    expect(tool.description).toBeDefined();
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it("should have an input schema", () => {
    expect(tool.inputSchema).toBeDefined();
  });

  it("should accept a query parameter", () => {
    const result = tool.inputSchema?.safeParse({
      query: "test query",
    });
    expect(result?.success).toBe(true);
  });

  it("should validate optional parameters", () => {
    const result = tool.inputSchema?.safeParse({
      query: "test query",
      numResults: 10,
      livecrawl: "preferred",
      type: "deep",
      contextMaxCharacters: 5000,
    });
    expect(result?.success).toBe(true);
  });
});
