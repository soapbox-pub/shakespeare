import { useEffect, useState } from 'react';
import { useFS } from './useFS';
import { loadProjectTools } from '@/lib/tools/project-tools-loader';
import type { Tool } from '@/lib/tools/Tool';

/**
 * Hook to load project-specific tools from .opencode/tools directory
 */
export function useProjectTools(projectPath: string, esmUrl: string): Record<string, Tool<unknown>> {
  const { fs } = useFS();
  const [tools, setTools] = useState<Record<string, Tool<unknown>>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      console.log(`[useProjectTools] Loading tools for project: ${projectPath}`);
      try {
        // Use static IDs since project tools don't need to be session-specific
        const loadedTools = await loadProjectTools(fs, projectPath, 'shakespeare', 'project-tools', esmUrl);
        if (mounted) {
          const toolCount = Object.keys(loadedTools).length;
          console.log(`[useProjectTools] Setting ${toolCount} tool(s) in state`);
          setTools(loadedTools);
        } else {
          console.log(`[useProjectTools] Component unmounted, not setting tools`);
        }
      } catch (error) {
        console.error('[useProjectTools] Failed to load project tools:', error);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [fs, projectPath, esmUrl]);

  console.log(`[useProjectTools] Current tools in state: ${Object.keys(tools).length} tool(s) - ${Object.keys(tools).join(', ')}`);

  return tools;
}
