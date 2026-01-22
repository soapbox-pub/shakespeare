import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import type { TodoInfo } from "./TodoWriteTool";
import { join } from "path-browserify";

type TodoReadParams = Record<string, never>;

export class TodoReadTool implements Tool<TodoReadParams> {
  private fs: JSRuntimeFS;
  private projectId: string;

  readonly description = "Use this tool to read your todo list";

  readonly inputSchema = z.object({});

  constructor(fs: JSRuntimeFS, projectId: string) {
    this.fs = fs;
    this.projectId = projectId;
  }

  async execute(_args: TodoReadParams): Promise<ToolResult> {
    try {
      // Read todos from .git/ai/TODO file
      const todoPath = join("/projects", this.projectId, ".git", "ai", "TODO");

      let todos: TodoInfo[] = [];

      try {
        const content = await this.fs.readFile(todoPath, "utf8");
        todos = JSON.parse(content);
      } catch {
        // File doesn't exist or is invalid - return empty array
        todos = [];
      }

      return {
        content: JSON.stringify(todos, null, 2),
      };
    } catch (error) {
      throw new Error(`Failed to read todos: ${String(error)}`);
    }
  }
}
