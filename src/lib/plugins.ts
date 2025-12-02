import { join } from 'path-browserify';
import matter from 'gray-matter';
import type { JSRuntimeFS } from './JSRuntime';
import * as git from 'isomorphic-git';

export interface Skill {
  /** Skill name (alphanumeric lowercase only) */
  name: string;
  /** Human-readable description of what the skill does */
  description: string;
  /** Full path to the skill directory */
  path: string;
  /** Plugin name that contains this skill */
  plugin: string;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  [key: string]: unknown;
}

export interface PluginGitInfo {
  commitHash: string;
  commitDate: Date;
  commitMessage: string;
}

/**
 * Validates a skill name (alphanumeric lowercase with hyphens)
 */
export function isValidSkillName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

/**
 * Get all plugins from the plugins directory
 */
export async function getPlugins(fs: JSRuntimeFS, pluginsPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(pluginsPath);
    const plugins: string[] = [];

    for (const entry of entries) {
      const stat = await fs.stat(join(pluginsPath, entry));
      if (stat.isDirectory()) {
        plugins.push(entry);
      }
    }

    return plugins;
  } catch {
    // Plugins directory doesn't exist yet
    return [];
  }
}

/**
 * Get all skills from a single plugin
 */
function getSkillsFromPlugin(
  fs: JSRuntimeFS,
  pluginsPath: string,
  pluginName: string
): Promise<Skill[]> {
  return getSkillsFromDirectory(fs, join(pluginsPath, pluginName, 'skills'), pluginName);
}

/**
 * Get skills from a directory with a given plugin/source name
 */
async function getSkillsFromDirectory(
  fs: JSRuntimeFS,
  skillsDir: string,
  sourceName: string
): Promise<Skill[]> {
  const skills: Skill[] = [];

  try {
    const skillDirs = await fs.readdir(skillsDir);

    for (const skillDir of skillDirs) {
      const skillPath = join(skillsDir, skillDir);
      const stat = await fs.stat(skillPath);

      if (!stat.isDirectory()) continue;

      const skillFilePath = join(skillPath, 'SKILL.md');

      try {
        const skillContent = await fs.readFile(skillFilePath, 'utf8');
        const { data } = matter(skillContent);

        const frontmatter = data as SkillFrontmatter;

        // Validate required fields
        if (!frontmatter.name || !frontmatter.description) {
          console.warn(`Skill at ${skillPath} missing required frontmatter fields (name, description)`);
          continue;
        }

        // Validate skill name format
        if (!isValidSkillName(frontmatter.name)) {
          console.warn(`Skill at ${skillPath} has invalid name "${frontmatter.name}" (must be lowercase alphanumeric with hyphens)`);
          continue;
        }

        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
          path: skillPath,
          plugin: sourceName,
        });
      } catch {
        // SKILL.md not found or invalid, skip this directory
        continue;
      }
    }
  } catch {
    // Skills directory doesn't exist
    return [];
  }

  return skills;
}

/**
 * Get all skills from a project's skills directory
 */
export async function getProjectSkills(
  fs: JSRuntimeFS,
  projectPath: string
): Promise<Skill[]> {
  return getSkillsFromDirectory(fs, join(projectPath, 'skills'), 'project');
}

/**
 * Get all skills from all plugins (without project skills)
 */
export async function getPluginSkills(fs: JSRuntimeFS, pluginsPath: string): Promise<Skill[]> {
  const plugins = await getPlugins(fs, pluginsPath);
  const allSkills: Skill[] = [];

  for (const plugin of plugins) {
    const skills = await getSkillsFromPlugin(fs, pluginsPath, plugin);
    allSkills.push(...skills);
  }

  return allSkills;
}

/**
 * Get all skills from both plugins and project, with project skills taking precedence
 */
export async function getAllSkills(
  fs: JSRuntimeFS,
  pluginsPath: string,
  projectPath: string
): Promise<Skill[]> {
  // Get skills from both sources
  const pluginSkills = await getPluginSkills(fs, pluginsPath);
  const projectSkills = await getProjectSkills(fs, projectPath);

  // Create a map to handle name collisions, with project skills taking precedence
  const skillsMap = new Map<string, Skill>();

  // Add plugin skills first
  for (const skill of pluginSkills) {
    skillsMap.set(skill.name, skill);
  }

  // Add project skills, overwriting any plugin skills with the same name
  for (const skill of projectSkills) {
    skillsMap.set(skill.name, skill);
  }

  // Return all skills as an array
  return Array.from(skillsMap.values());
}

/**
 * Find a skill by name across both plugins and project, with project skills taking precedence
 */
export async function findSkill(
  fs: JSRuntimeFS,
  pluginsPath: string,
  projectPath: string,
  skillName: string
): Promise<Skill | null> {
  const skills = await getAllSkills(fs, pluginsPath, projectPath);
  return skills.find(skill => skill.name === skillName) || null;
}

/**
 * Read the SKILL.md content for a skill
 */
export async function readSkillContent(fs: JSRuntimeFS, skill: Skill): Promise<string> {
  const skillFilePath = join(skill.path, 'SKILL.md');
  return await fs.readFile(skillFilePath, 'utf8');
}

/**
 * Get git information for a plugin
 */
export async function getPluginGitInfo(fs: JSRuntimeFS, pluginsPath: string, pluginName: string): Promise<PluginGitInfo | null> {
  const pluginPath = join(pluginsPath, pluginName);

  try {
    // Get the latest commit
    const commits = await git.log({
      fs,
      dir: pluginPath,
      depth: 1,
    });

    if (commits.length === 0) {
      return null;
    }

    const commit = commits[0];

    return {
      commitHash: commit.oid,
      commitDate: new Date(commit.commit.committer.timestamp * 1000),
      commitMessage: commit.commit.message,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a plugin directory
 */
export async function deletePlugin(fs: JSRuntimeFS, pluginsPath: string, pluginName: string): Promise<void> {
  const pluginPath = join(pluginsPath, pluginName);

  // Recursively delete the plugin directory
  async function rmrf(path: string): Promise<void> {
    const stat = await fs.stat(path);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(path);
      for (const entry of entries) {
        await rmrf(join(path, entry));
      }
      await fs.rmdir(path);
    } else {
      await fs.unlink(path);
    }
  }

  await rmrf(pluginPath);
}
