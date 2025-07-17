import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { contextualAITools } from './ai-tools';

const fileOperationSchema = z.object({
  filePath: z.string(),
  content: z.string().optional(),
});

const buildSchema = z.object({});

export async function createAIChat(projectId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  // Set the project context for the AI tools
  contextualAITools.setCurrentProjectId(projectId);

  const result = await streamText({
    model: openai('gpt-4-turbo-preview'),
    messages,
    tools: {
      readFile: tool({
        description: 'Read the contents of a file in the project',
        parameters: fileOperationSchema,
        execute: async ({ filePath }) => {
          return await contextualAITools.readFile(filePath);
        },
      }),
      writeFile: tool({
        description: 'Write content to a file in the project',
        parameters: fileOperationSchema,
        execute: async ({ filePath, content }) => {
          return await contextualAITools.writeFile(filePath, content || '');
        },
      }),
      deleteFile: tool({
        description: 'Delete a file from the project',
        parameters: fileOperationSchema,
        execute: async ({ filePath }) => {
          return await contextualAITools.deleteFile(filePath);
        },
      }),
      listFiles: tool({
        description: 'List files in a directory',
        parameters: fileOperationSchema,
        execute: async ({ filePath }) => {
          return await contextualAITools.listFiles(filePath);
        },
      }),
      fileExists: tool({
        description: 'Check if a file exists',
        parameters: fileOperationSchema,
        execute: async ({ filePath }) => {
          return await contextualAITools.fileExists(filePath);
        },
      }),
      buildProject: tool({
        description: 'Build the project using Vite',
        parameters: buildSchema,
        execute: async () => {
          return await contextualAITools.buildProject();
        },
      }),
      getProjectStructure: tool({
        description: 'Get the complete file structure of the project',
        parameters: buildSchema,
        execute: async () => {
          return await contextualAITools.getProjectStructure();
        },
      }),
      searchFiles: tool({
        description: 'Search for files containing specific text',
        parameters: z.object({
          query: z.string(),
        }),
        execute: async ({ query }) => {
          return await contextualAITools.searchFiles(query);
        },
      }),
    },
    system: `You are an AI assistant helping users build custom Nostr websites. You have access to tools that allow you to read, write, and manage files in the project, as well as build the project.

Key capabilities:
- Read and write files in the project
- List directory contents
- Check if files exist
- Build the project using Vite
- Get project structure overview
- Search through files

Guidelines:
- Always check if files exist before writing to avoid overwriting
- Provide helpful explanations of what you're doing
- Suggest improvements and best practices
- Use modern React patterns and TypeScript
- Follow Nostr protocol standards when relevant
- Ensure the project builds successfully

The project uses:
- React 18 with TypeScript
- Vite for building
- TailwindCSS for styling
- Nostrify for Nostr integration
- shadcn/ui components

When creating new components or pages, follow the existing patterns in the codebase.`
  });

  return result;
}