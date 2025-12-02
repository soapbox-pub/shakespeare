import { z } from 'zod';
import type { Tool } from './Tool';
import type { JSRuntimeFS } from '../JSRuntime';
import { findSkill, readSkillContent } from '../plugins';

interface SkillParams {
  name: string;
}

export class SkillTool implements Tool<SkillParams> {
  private fs: JSRuntimeFS;
  private pluginsPath: string;
  private projectPath: string;

  readonly description = 'Load and execute a skill from the configured plugins or project. Skills are reusable AI workflows that can be invoked by name.';

  readonly inputSchema = z.object({
    name: z.string().describe('The name of the skill to execute (lowercase alphanumeric with hyphens)'),
  });

  constructor(fs: JSRuntimeFS, pluginsPath: string, projectPath: string) {
    this.fs = fs;
    this.pluginsPath = pluginsPath;
    this.projectPath = projectPath;
  }

  async execute(args: SkillParams): Promise<string> {
    const { name } = args;

    try {
      // Find the skill across all plugins and project
      const skill = await findSkill(this.fs, this.pluginsPath, this.projectPath, name);

      if (!skill) {
        throw new Error(`Skill "${name}" not found. Use the skill tool to list available skills or configure plugins in Settings > AI.`);
      }

      // Read and return the skill content
      const content = await readSkillContent(this.fs, skill);

      return `# Skill: ${skill.name}

**Source**: ${skill.plugin === 'project' ? 'Project' : `Plugin: ${skill.plugin}`}
**Description**: ${skill.description}
**Path**: ${skill.path}

---

${content}`;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to execute skill "${name}": ${String(error)}`);
    }
  }
}
