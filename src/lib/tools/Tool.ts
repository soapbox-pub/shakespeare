import type z from "zod";

export interface ToolResult {
  content: string;
  cost?: number;
}

export interface Tool<TParams> {
  description: string;
  inputSchema?: z.ZodType<TParams>;
  execute(args: TParams): Promise<ToolResult>;
}
