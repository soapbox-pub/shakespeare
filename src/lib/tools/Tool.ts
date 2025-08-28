import type z from "zod";

export interface Tool<TParams> {
  description: string;
  inputSchema: z.ZodType<TParams>;
  execute(args: TParams): Promise<string>;
}
