import { z } from 'zod';
import type { Tool, ToolResult } from './Tool';
import type { JSRuntimeFS } from '../JSRuntime';
import { readSkillContent, type Skill } from '../skills';

interface SkillParams {
  name: string;
}

export class SkillTool implements Tool<SkillParams> {
  private fs: JSRuntimeFS;
  private availableSkills: Skill[];
  readonly description: string;

  readonly inputSchema = z.object({
    name: z.string().describe('The skill identifier from available_skills'),
  });

  /**
   * Create a SkillTool instance.
   * @param fs - Filesystem instance
   * @param availableSkills - List of available skills (should be pre-loaded)
   */
  constructor(fs: JSRuntimeFS, availableSkills: Skill[]) {
    this.fs = fs;
    this.availableSkills = availableSkills;
    this.description = this.generateDescription(availableSkills);
  }

  /**
   * Generate description text for SkillTool based on available skills.
   */
  private generateDescription(skills: Skill[]): string {
    if (skills.length === 0) {
      return 'Load a skill to get detailed instructions for a specific task. No skills are currently available.';
    }

    return [
      'Load a skill to get detailed instructions for a specific task.',
      'Skills provide specialized knowledge and step-by-step guidance.',
      'Use this when a task matches an available skill\'s description.',
      '<available_skills>',
      ...skills.map(skill =>
        `  <skill>\n    <name>${skill.name}</name>\n    <description>${skill.description}</description>\n  </skill>`
      ),
      '</available_skills>',
    ].join('\n');
  }

  async execute(args: SkillParams): Promise<ToolResult> {
    const { name } = args;

    try {
      // Find the skill in the pre-loaded list
      const skill = this.availableSkills.find(s => s.name === name);

      if (!skill) {
        const available = this.availableSkills.map(s => s.name).join(', ');
        throw new Error(`Skill "${name}" not found. Available skills: ${available || 'none'}`);
      }

      // Read and return the skill content
      const content = await readSkillContent(this.fs, skill);

      return {
        content: `## Skill: ${skill.name}

**Base directory**: ${skill.path}

${content.trim()}`
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to execute skill "${name}": ${String(error)}`);
    }
  }
}
