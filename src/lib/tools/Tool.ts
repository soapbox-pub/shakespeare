import type z from "zod";

export interface ToolResult {
  content: string;
  /** Images (data URLs) for the model to see along with the content */
  images?: string[];
  cost?: number;
}

export interface ToolExecuteOptions {
  /** Aborted when the user stops the AI. Tools that take long (or cost money) should stop work when it fires. */
  signal?: AbortSignal;
}

export interface Tool<TParams> {
  description: string;
  inputSchema?: z.ZodType<TParams>;
  execute(args: TParams, options?: ToolExecuteOptions): Promise<ToolResult>;
}
