import type { Tool } from './Tool';
import type { MCPClient } from '@/lib/MCPClient';

/**
 * Wrapper for MCP tools to integrate with Shakespeare's tool system.
 */
export class MCPTool implements Tool<Record<string, unknown>> {
  description: string;
  private client: MCPClient;
  private originalToolName: string;

  constructor(
    description: string,
    client: MCPClient,
    originalToolName: string
  ) {
    this.description = description;
    this.client = client;
    this.originalToolName = originalToolName;
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    return await this.client.callTool(this.originalToolName, args);
  }
}

/**
 * Create MCPTool instances from discovered MCP tools.
 */
export function createMCPTools(
  clients: Record<string, MCPClient>
): Record<string, Tool<unknown>> {
  const tools: Record<string, Tool<unknown>> = {};

  for (const [prefixedName, client] of Object.entries(clients)) {
    // Extract original tool name by removing server prefix
    const parts = prefixedName.split('__');
    const originalToolName = parts.slice(1).join('__');

    tools[prefixedName] = new MCPTool(
      `MCP tool: ${prefixedName}`,
      client,
      originalToolName
    );
  }

  return tools;
}
