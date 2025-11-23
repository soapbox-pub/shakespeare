import { useQuery } from '@tanstack/react-query';
import { useAISettings } from './useAISettings';
import { discoverMCPTools } from '@/lib/MCPClient';
import type OpenAI from 'openai';
import type { MCPClient } from '@/lib/MCPClient';

interface UseMCPToolsResult {
  tools: Record<string, OpenAI.Chat.Completions.ChatCompletionTool>;
  clients: Record<string, MCPClient>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to discover and manage MCP tools from configured servers.
 */
export function useMCPTools(): UseMCPToolsResult {
  const { settings } = useAISettings();
  const mcpServers = settings.mcpServers || {};

  const { data, isLoading, error } = useQuery({
    queryKey: ['mcp-tools', mcpServers],
    queryFn: async () => {
      if (Object.keys(mcpServers).length === 0) {
        return { tools: {}, clients: {} };
      }
      return await discoverMCPTools(mcpServers);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  return {
    tools: data?.tools || {},
    clients: data?.clients || {},
    isLoading,
    error: error as Error | null,
  };
}
