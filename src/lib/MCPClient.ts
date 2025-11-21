import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPServer } from '@/contexts/AISettingsContext';
import type OpenAI from 'openai';

/**
 * MCP (Model Context Protocol) Client for discovering and executing tools from MCP servers.
 * Uses the official @modelcontextprotocol/sdk library.
 */
export class MCPClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private connected = false;

  constructor(server: MCPServer) {
    // Create the client
    this.client = new Client({
      name: 'shakespeare',
      version: '1.0.0',
    }, {
      capabilities: {}
    });

    // Create HTTP transport
    this.transport = new StreamableHTTPClientTransport(new URL(server.url));
  }

  /**
   * Connect to the MCP server.
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    await this.client.connect(this.transport);
    this.connected = true;
  }

  /**
   * List all available tools from the MCP server.
   */
  async listTools(): Promise<Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, object>;
      required?: string[];
    };
  }>> {
    await this.connect();

    const result = await this.client.listTools();
    return result.tools;
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    await this.connect();

    const result = await this.client.callTool({
      name,
      arguments: args,
    });

    const content = Array.isArray(result.content) ? result.content : [];

    if (result.isError) {
      const errorText = content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      throw new Error(`MCP tool error: ${errorText}`);
    }

    // Concatenate all text content from the response
    return content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  /**
   * Close the connection to the MCP server.
   */
  async close(): Promise<void> {
    if (!this.connected) return;

    await this.client.close();
    this.connected = false;
  }

  /**
   * Convert MCP tools to OpenAI tool format.
   */
  static toOpenAITools(mcpTools: Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, object>;
      required?: string[];
    };
  }>): Record<string, OpenAI.Chat.Completions.ChatCompletionTool> {
    const tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {};

    for (const tool of mcpTools) {
      tools[tool.name] = {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      } as OpenAI.Chat.Completions.ChatCompletionTool;
    }

    return tools;
  }
}

/**
 * Discover tools from all configured MCP servers.
 */
export async function discoverMCPTools(
  mcpServers: Record<string, MCPServer>
): Promise<{
  tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  clients: Record<string, MCPClient>;
}> {
  const allTools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {};
  const clients: Record<string, MCPClient> = {};

  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    try {
      const client = new MCPClient(serverConfig);
      const mcpTools = await client.listTools();
      const openAITools = MCPClient.toOpenAITools(mcpTools);

      // Store tools with server prefix to avoid name collisions
      for (const [toolName, tool] of Object.entries(openAITools)) {
        const prefixedName = `${serverName}__${toolName}`;
        const functionTool = tool as OpenAI.Chat.Completions.ChatCompletionTool & {
          function: { name: string; description: string; parameters: Record<string, unknown> }
        };
        allTools[prefixedName] = {
          type: 'function',
          function: {
            ...functionTool.function,
            name: prefixedName,
            description: `[${serverName}] ${functionTool.function.description}`,
          },
        } as OpenAI.Chat.Completions.ChatCompletionTool;
        clients[prefixedName] = client;
      }
    } catch (error) {
      console.error(`Failed to discover tools from MCP server "${serverName}":`, error);
    }
  }

  return { tools: allTools, clients };
}
