import { join } from "@std/path";

import OpenAI from "openai";
import { JSRuntimeFS } from "./JSRuntime";

export interface MakeSystemPromptOpts {
  name: string;
  profession: string;
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  mode: "init" | "agent";
  fs: JSRuntimeFS;
  cwd: string;
}

export async function makeSystemPrompt(opts: MakeSystemPromptOpts): Promise<string> {
  const { name, profession, tools, mode, fs, cwd } = opts;

  let system = mode === "init"
    ? `You are ${name}, an expert ${profession}. The files in the current directory are a template. Your goal is to transform this template into a working project according to the user's request.`
    : `You are ${name}, an expert ${profession}. Your goal is to work on the project in the current directory according to the user's request. First, explore and understand the project structure, examine the existing files, and understand the context before making any assumptions about what the user is asking for.`;

  // Add current date
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  system += `\n\nThe current date is ${currentDate}.`;

  // Add available tools to the system prompt
  const toolNames = tools
    .filter((tool) => tool.type === "function")
    .map((tool) => tool.function.name);

  if (toolNames.length > 0) {
    system +=
      "\n\n# Available Tools\n\nYou have access to the following tools:\n";
    for (const tool of tools) {
      if (tool.type === "function") {
        system += `\n- **${tool.function.name}**: ${
          tool.function.description || "No description available"
        }`;
      }
    }
  }

  // Add README.md if it exists
  try {
    const readmePath = join(cwd, "README.md");
    const readmeText = await fs.readFile(readmePath, "utf8");
    if (readmeText) {
      system += "\n\n" + readmeText;
    }
  } catch {
    // README.md not found, continue
  }

  // Add context from CONTEXT.md if it exists
  try {
    const { text } = await getContext(fs, cwd);
    system += "\n\n" + text;
  } catch {
    // CONTEXT.md not found, continue
  }

  return system;
}

async function getContext(
  fs: JSRuntimeFS,
  cwd: string,
): Promise<{ filename: string; text: string }> {
  const contextFiles = [
    "CONTEXT.md",
    "CLAUDE.md",
    "codex.md",
    ".goosehints",
    ".cursorrules",
    ".github/copilot-instructions.md",
  ];

  for (const filename of contextFiles) {
    const filePath = join(cwd, filename);
    try {
      const text = await fs.readFile(filePath, "utf8");
      if (text) {
        return { filename, text };
      }
    } catch {
      // continue
    }
  }

  throw new Error(
    `No context file found in ${cwd}. Please create one of the following files: ${
      contextFiles.join(", ")
    }`,
  );
}
