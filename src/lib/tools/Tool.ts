import type z from "zod";

export interface Tool<TParams> {
  description: string;
  parameters: z.ZodType<TParams>;
  execute(args: TParams): Promise<CallToolResult>;
}

export interface CallToolResult {
  content: { type: "text"; text: string; }[];
  isError?: boolean;
}