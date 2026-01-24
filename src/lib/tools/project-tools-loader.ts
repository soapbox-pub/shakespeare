import type { JSRuntimeFS } from '@/lib/JSRuntime';
import { Tool, ToolResult } from './Tool';
import { z } from 'zod';
import { getEsbuild } from '@/lib/esbuild';
import { esmPlugin } from '@/lib/build/esmPlugin';
import { fsPlugin } from '@/lib/build/fsPlugin';

// OpenCode tool definition types
interface OpenCodeToolContext {
  sessionID: string;
  messageID: string;
  agent: string;
  abort: AbortSignal;
  metadata(input: { title?: string; metadata?: Record<string, unknown> }): void;
  ask(input: {
    permission: string;
    patterns: string[];
    always: string[];
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

interface OpenCodeToolDefinition {
  description: string;
  args: Record<string, z.ZodType>;
  execute(args: unknown, context: OpenCodeToolContext): Promise<string>;
}

/**
 * Bundle a tool file using esbuild with esmPlugin and fsPlugin
 */
async function bundleTool(
  code: string,
  filename: string,
  fs: JSRuntimeFS,
  projectPath: string,
  esmUrl: string
): Promise<string> {
  try {
    const esbuild = await getEsbuild();

    const result = await esbuild.build({
      stdin: {
        contents: code,
        sourcefile: filename,
        loader: filename.endsWith('.ts') ? 'ts' : 'js',
      },
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      write: false,
      plugins: [
        fsPlugin({ fs, cwd: projectPath }),
        esmPlugin({ 
          packageJson: { dependencies: {} }, 
          esmUrl 
        }),
      ],
    });

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error('No output from esbuild');
    }

    return result.outputFiles[0].text;
  } catch (error) {
    console.warn(`Failed to bundle ${filename}:`, error);
    throw error;
  }
}

/**
 * Load and execute a tool module
 */
async function loadToolModule(
  bundledCode: string,
  filename: string
): Promise<Record<string, OpenCodeToolDefinition> | null> {
  try {
    // Create a blob URL for the module
    const blob = new Blob([bundledCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      // Dynamically import the module
      const module = await import(/* @vite-ignore */ url);
      return module as Record<string, OpenCodeToolDefinition>;
    } finally {
      // Clean up the blob URL
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.warn(`Failed to load tool module ${filename}:`, error);
    return null;
  }
}

/**
 * Convert an OpenCode tool to Shakespeare's tool format
 */
function convertOpenCodeTool(
  name: string,
  openCodeTool: OpenCodeToolDefinition,
  sessionID: string,
  messageID: string
): Tool<unknown> {
  return {
    description: openCodeTool.description,
    inputSchema: z.object(openCodeTool.args),
    async execute(args: unknown): Promise<ToolResult> {
      // Create a minimal context for the OpenCode tool
      const context: OpenCodeToolContext = {
        sessionID,
        messageID,
        agent: 'shakespeare',
        abort: new AbortController().signal,
        metadata: () => {}, // No-op for now
        ask: async () => {}, // No-op for now
      };

      try {
        const result = await openCodeTool.execute(args, context);
        return {
          content: result,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: `Error executing tool ${name}: ${errorMessage}`,
        };
      }
    },
  };
}

/**
 * Load project-specific tools from .opencode/tools directory
 */
export async function loadProjectTools(
  fs: JSRuntimeFS,
  projectPath: string,
  sessionID: string,
  messageID: string,
  esmUrl: string
): Promise<Record<string, Tool<unknown>>> {
  const tools: Record<string, Tool<unknown>> = {};
  const toolsDir = `${projectPath}/.opencode/tools`;

  console.log(`[Project Tools] Scanning for tools in: ${toolsDir}`);

  try {
    // Check if .opencode/tools directory exists
    try {
      const stat = await fs.stat(toolsDir);
      if (!stat.isDirectory()) {
        console.log('[Project Tools] Path exists but is not a directory');
        return tools;
      }
    } catch {
      // Directory doesn't exist
      console.log('[Project Tools] Directory does not exist, skipping');
      return tools;
    }

    // Get list of tool files (*.ts and *.js)
    const files = await fs.readdir(toolsDir);
    const toolFiles = files.filter(
      (file) => file.endsWith('.ts') || file.endsWith('.js')
    );

    console.log(`[Project Tools] Found ${toolFiles.length} tool file(s): ${toolFiles.join(', ')}`);

    if (toolFiles.length === 0) {
      console.log('[Project Tools] No tool files found');
      return tools;
    }

    // Load and bundle each tool file
    for (const file of toolFiles) {
      const toolPath = `${toolsDir}/${file}`;
      const namespace = file.replace(/\.(ts|js)$/, '');

      console.log(`[Project Tools] Loading tool file: ${file}`);

      try {
        // Read the tool file
        const code = await fs.readFile(toolPath, 'utf8');
        console.log(`[Project Tools] Read ${code.length} bytes from ${file}`);

        // Bundle the tool with proper dependency resolution
        console.log(`[Project Tools] Bundling ${file}...`);
        const bundledCode = await bundleTool(code, file, fs, projectPath, esmUrl);
        console.log(`[Project Tools] Bundled to ${bundledCode.length} bytes`);

        // Load and execute the bundled module
        console.log(`[Project Tools] Loading module from ${file}...`);
        const module = await loadToolModule(bundledCode, file);
        if (!module) {
          console.warn(`[Project Tools] Failed to load module from ${file}`);
          continue;
        }

        console.log(`[Project Tools] Module loaded, extracting exports from ${file}`);

        // Extract tools from the module
        let exportCount = 0;
        for (const [exportName, toolDef] of Object.entries(module)) {
          if (!toolDef || typeof toolDef !== 'object') {
            console.debug(`[Project Tools] Skipping non-object export "${exportName}" in ${file}`);
            continue;
          }

          const openCodeTool = toolDef as OpenCodeToolDefinition;

          // Validate that it looks like an OpenCode tool
          if (
            !openCodeTool.description ||
            !openCodeTool.args ||
            !openCodeTool.execute
          ) {
            console.debug(`[Project Tools] Skipping invalid tool export "${exportName}" in ${file} (missing description, args, or execute)`);
            continue;
          }

          // Determine the tool name
          const toolName =
            exportName === 'default' ? namespace : `${namespace}_${exportName}`;

          console.log(`[Project Tools] Registering tool: ${toolName} - ${openCodeTool.description}`);

          // Convert and register the tool
          tools[toolName] = convertOpenCodeTool(
            toolName,
            openCodeTool,
            sessionID,
            messageID
          );
          exportCount++;
        }

        console.log(`[Project Tools] Successfully loaded ${exportCount} tool(s) from ${file}`);
      } catch (error) {
        // Log errors for debugging but don't fail the entire load
        console.warn(`[Project Tools] Failed to load tool ${file}:`, error);
      }
    }

    const toolCount = Object.keys(tools).length;
    console.log(`[Project Tools] ✓ Loaded ${toolCount} custom tool(s) total: ${Object.keys(tools).join(', ')}`);
  } catch (error) {
    // Log errors for debugging
    console.error('[Project Tools] Error loading project tools:', error);
  }

  return tools;
}
