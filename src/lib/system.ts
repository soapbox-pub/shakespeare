import { NUser } from "@nostrify/react/login";
import { NostrMetadata } from "@nostrify/nostrify";
import { join } from "path-browserify";
import OpenAI from "openai";
import { nip19 } from "nostr-tools";
import { JSRuntimeFS } from "./JSRuntime";

export interface MakeSystemPromptOpts {
  name: string;
  profession: string;
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  mode: "init" | "agent";
  fs: JSRuntimeFS;
  cwd: string;
  user?: NUser;
  metadata?: NostrMetadata;
}

export async function makeSystemPrompt(opts: MakeSystemPromptOpts): Promise<string> {
  const { name, profession, tools, mode, fs, cwd, user, metadata } = opts;

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

  let userText: string;
  if (user) {
    userText = `The user is logged into Nostr with the following profile:

- **Nostr pubkey (hex)**: ${user.pubkey}
- **Nostr npub**: ${nip19.npubEncode(user.pubkey)}`;

    if (metadata?.name) userText += `\n- **Name**: ${metadata.name}`;
    if (metadata?.about) userText += `\n- **About**: ${metadata.about.replace(/[\r\n]+/g, ' ')}`;
    if (metadata?.website) userText += `\n- **Website**: ${metadata.website}`;
    if (metadata?.picture) userText += `\n- **Avatar**: ${metadata.picture}`;
    if (metadata?.banner) userText += `\n- **Banner**: ${metadata.banner}`;
    if (metadata?.nip05) userText += `\n- **NIP-05**: ${metadata.nip05}`;
    if (metadata?.lud16) userText += `\n- **Lightning Address**: ${metadata.lud16}`;

    userText += `Since the user is logged in, they can deploy their creations to public URLs and use Nostr-enabled AI providers.`;
  } else {
    userText = `The user is not logged in. The user can log into Nostr by clicking the "Login" button in the sidebar menu. Logging in will allow the user to deploy their creations to public URLs and use Nostr-enabled AI providers.`;
  }

  // Add Your Environment section
  system += `\n\n# Your Environment

You are operating within **Shakespeare**, an AI-powered Nostr website builder that allows users to create custom Nostr applications through natural language conversation.

- **Current Date**: ${currentDate}
- **Current Working Directory**: ${cwd}

## What Shakespeare Is

Shakespeare is a web-based development environment where users can build Nostr websites and applications by chatting with an AI assistant (you). The platform combines the power of AI-driven development with a user-friendly interface that requires no coding knowledge from the user.

## The User

${userText}

## User Interface

The Shakespeare interface consists of several key areas:

1. **Homepage**: A simple interface with:
   - A large textarea where users can describe what they want to build
   - A submit button to create new projects from their description
   - A left sidebar containing the list of existing projects for easy access

2. **Project View** (CURRENT): A split-pane interface with:
   - **Left Pane**: AI chat interface where users converse with you
   - **Right Pane**: Toggles between two views:
     - **Preview Mode**: Live preview of the website being built
     - **Code View**: File explorer and code editor with syntax highlighting

3. **File Management**: In code view, users can:
   - Browse project files in a tree structure
   - Edit files directly with syntax highlighting
   - Create, rename, and delete files
   - Save changes to the project

## User Actions

Users interact with Shakespeare by:

1. **Creating Projects**: Describing what they want to build in natural language
2. **Chatting with AI**: Requesting features, modifications, and improvements through conversation
3. **Manual Code Editing**: Switching to code view to make direct file edits when desired
4. **Previewing Changes**: Viewing their website in real-time as it's being built
5. **Project Management**: Organizing and accessing multiple projects from the homepage
6. **Deploying Projects**: Publishing their creations to public URLs (requires Nostr login)

## Your Role

As the AI assistant in Shakespeare, you help users by:
- Understanding their requirements through natural conversation
- Writing and modifying code files to build their Nostr applications
- Explaining technical concepts in accessible terms
- Providing suggestions and best practices
- Troubleshooting issues and implementing fixes
- Building complete, functional Nostr websites and applications

The user expects you to handle all technical implementation while they focus on describing their vision and requirements.`;

  // Add available tools to the system prompt
  const toolNames = tools
    .filter((tool) => tool.type === "function")
    .map((tool) => tool.function.name);

  if (toolNames.length > 0) {
    system +=
      "\n\n## Available Tools\n\nYou have access to the following tools:\n";
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

  // Add context from AGENTS.md if it exists
  try {
    const { text } = await getAgentContext(fs, cwd);
    system += "\n\n" + text;
  } catch {
    // AGENTS.md not found, continue
  }

  return system;
}

async function getAgentContext(
  fs: JSRuntimeFS,
  cwd: string,
): Promise<{ filename: string; text: string }> {
  const contextFiles = [
    "AGENTS.md",
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
