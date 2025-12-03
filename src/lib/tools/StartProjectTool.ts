import { z } from "zod";
import type { Tool } from "./Tool";
import type { ProjectsManager } from "@/lib/ProjectsManager";
import type { AppConfig } from "@/contexts/AppContext";

const startProjectSchema = z.object({
  project_name: z.string().describe('A short, unique, and memorable name for the project. Should be lowercase, use hyphens instead of spaces, and contain only alphanumeric characters and hyphens.'),
  template_url: z.string().describe('The Git URL of the selected template.'),
  initial_message: z.string().describe('The initial user message that will start the project chat session.'),
});

type StartProjectParams = z.infer<typeof startProjectSchema>;

export interface StartProjectResult {
  projectId: string;
  initialMessage: string;
}

export class StartProjectTool implements Tool<StartProjectParams> {
  private projectsManager: ProjectsManager;
  private config: AppConfig;
  private onProjectCreated: (result: StartProjectResult) => void;

  readonly description: string;
  readonly inputSchema = startProjectSchema;

  constructor(
    projectsManager: ProjectsManager,
    config: AppConfig,
    onProjectCreated: (result: StartProjectResult) => void
  ) {
    this.projectsManager = projectsManager;
    this.config = config;
    this.onProjectCreated = onProjectCreated;

    // Build description with available templates
    const templatesList = config.templates.map(t => `     - ${t.name}: ${t.description} (${t.url})`).join('\n');
    
    this.description = `Start a new project by choosing a name and selecting the most appropriate template. Call this when the user wants to build an app or website.

Available templates:
${templatesList}

After creating the project, the chat session will be stopped and the new project will be opened with the initial message.`;
  }

  async execute(args: StartProjectParams): Promise<string> {
    const { project_name, template_url, initial_message } = args;

    // Validate template URL
    const selectedTemplate = this.config.templates.find(t => t.url === template_url);
    if (!selectedTemplate) {
      throw new Error(`Invalid template URL: ${template_url}. Must be one of: ${this.config.templates.map(t => t.url).join(', ')}`);
    }

    // Validate the generated project ID
    const validIdRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    let projectId = project_name;

    if (!projectId || projectId.length > 50 || !validIdRegex.test(projectId)) {
      throw new Error(`Invalid project name: ${project_name}. Must be lowercase, use hyphens instead of spaces, contain only alphanumeric characters and hyphens, and be 50 characters or less.`);
    }

    // Check if project exists and generate incremented name if needed
    let existingProject = await this.projectsManager.getProject(projectId);
    
    if (existingProject !== null) {
      // Project already exists - increment the AI-generated ID
      let counter = 1;
      let fallbackId = `${projectId}-${counter}`;
      existingProject = await this.projectsManager.getProject(fallbackId);

      while (existingProject !== null) {
        counter++;
        fallbackId = `${projectId}-${counter}`;
        existingProject = await this.projectsManager.getProject(fallbackId);
      }

      projectId = fallbackId;
    }

    // Create the project
    await this.projectsManager.createProject(
      projectId,
      template_url,
      projectId,
      undefined,
      {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
      }
    );

    // Trigger the callback to navigate to the new project
    this.onProjectCreated({
      projectId,
      initialMessage: initial_message,
    });

    return `✅ Successfully created project "${projectId}" using template "${selectedTemplate.name}". Opening project now...`;
  }
}
