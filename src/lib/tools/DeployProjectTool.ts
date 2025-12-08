import { z } from "zod";

import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import { ShakespeareAdapter } from "../deploy";
import type { NostrSigner } from "@nostrify/nostrify";

interface DeployProjectParams {
  deployServer?: string;
}

export class DeployProjectTool implements Tool<DeployProjectParams> {
  private fs: JSRuntimeFS;
  private cwd: string;
  private signer: NostrSigner;
  private projectId: string;

  readonly description = "Deploy the project to a hosting server using NIP-98 authentication. Creates a ZIP of the dist directory and uploads it to the deployment server. Requires the user to be logged in with Nostr.";

  readonly inputSchema = z.object({
    deployServer: z.string().optional().describe("Deploy server domain (e.g., 'shakespeare.wtf'). If not provided, uses the default configured server."),
  });

  constructor(fs: JSRuntimeFS, cwd: string, signer: NostrSigner, projectId: string) {
    this.fs = fs;
    this.cwd = cwd;
    this.signer = signer;
    this.projectId = projectId;
  }

  async execute(args: DeployProjectParams): Promise<ToolResult> {
    try {
      // Use provided deployServer or default to shakespeare.wtf
      const deployServer = args.deployServer || "shakespeare.wtf";

      // Check if we're in a valid project directory
      try {
        await this.fs.readFile(`${this.cwd}/package.json`, "utf8");
      } catch {
        throw new Error(`❌ Could not find package.json at ${this.cwd}. Make sure you're in a valid project directory.`);
      }

      // Check if dist directory exists and contains index.html
      try {
        await this.fs.readFile(`${this.cwd}/dist/index.html`, "utf8");
      } catch {
        throw new Error(`❌ Could not find index.html in dist directory. Please build the project first using the build tool.`);
      }

      // Deploy the project using ShakespeareAdapter
      const adapter = new ShakespeareAdapter({
        fs: this.fs,
        signer: this.signer,
        host: deployServer,
      });

      const result = await adapter.deploy({
        projectId: this.projectId,
        projectPath: this.cwd,
      });

      return {
        content: `✅ Successfully deployed project!\n\n🌐 Live URL: ${result.url}\n\n🚀 Your project is now live and accessible to anyone with the URL!`
      };
    } catch (error) {
      throw new Error(`❌ Deployment failed: ${String(error)}`);
    }
  }
}