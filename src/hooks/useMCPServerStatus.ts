import { useEffect, useState } from 'react';
import { MCPClient } from '@/lib/MCPClient';
import type { MCPServer } from '@/contexts/AISettingsContext';

/**
 * Hook to check the connection status of an MCP server.
 * Returns 'connected', 'offline', or 'checking'.
 */
export function useMCPServerStatus(server: MCPServer): 'connected' | 'offline' | 'checking' {
  const [status, setStatus] = useState<'connected' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      setStatus('checking');
      
      try {
        const client = new MCPClient(server);
        await client.connect();
        
        // Try to list tools to verify the connection is working
        await client.listTools();
        
        await client.close();
        
        if (!cancelled) {
          setStatus('connected');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('offline');
        }
      }
    }

    checkConnection();

    return () => {
      cancelled = true;
    };
  }, [server.url]); // Re-check when URL changes

  return status;
}
