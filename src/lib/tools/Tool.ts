import type z from "zod";

export interface ToolResult {
  content: string;
  /** Images (data URLs) for the model to see along with the content */
  images?: string[];
  cost?: number;
}

export interface Tool<TParams> {
  description: string;
  inputSchema?: z.ZodType<TParams>;
  execute(args: TParams): Promise<ToolResult>;
}
