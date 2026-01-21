import { describe, it, expect, beforeEach } from 'vitest';
import type { JSRuntimeFS } from './JSRuntime';
import {
  getPluginSkills,
  getProjectSkills,
  getAllSkills,
  findSkill,
  readSkillContent,
  isValidSkillName,
} from './skills';

// Mock filesystem for testing
class MockFS implements JSRuntimeFS {
  private files: Map<string, string | Uint8Array> = new Map();
  private dirs: Set<string> = new Set();

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: 'utf8'): Promise<string>;
  async readFile(path: string, options: string): Promise<string>;
  async readFile(path: string, options: { encoding: 'utf8' }): Promise<string>;
  async readFile(path: string, options: { encoding: string }): Promise<string>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array>;
  async readFile(path: string, options?: string | { encoding?: string }): Promise<string | Uint8Array> {
    const content = this.files.get(path);
    if (!content) throw new Error(`ENOENT: ${path}`);

    const encoding = typeof options === 'string' ? options : options?.encoding;
    if (encoding === 'utf8') {
      return typeof content === 'string' ? content : new TextDecoder().decode(content);
    }
    return typeof content === 'string' ? new TextEncoder().encode(content) : content;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    this.files.set(path, data);
    // Auto-create parent directories
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      this.dirs.add(parts.slice(0, i).join('/') || '/');
    }
  }

  async readdir(path: string): Promise<string[]>;
  async readdir(path: string, options: { withFileTypes: true }): Promise<import('./JSRuntime').DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | import('./JSRuntime').DirectoryEntry[]>;
  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | import('./JSRuntime').DirectoryEntry[]> {
    if (!this.dirs.has(path)) throw new Error(`ENOENT: ${path}`);

    const entries = new Set<string>();
    const prefix = path === '/' ? '/' : path + '/';

    // Check files
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        const firstPart = relativePath.split('/')[0];
        if (firstPart) entries.add(firstPart);
      }
    }

    // Check directories
    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(prefix) && dirPath !== path) {
        const relativePath = dirPath.slice(prefix.length);
        const firstPart = relativePath.split('/')[0];
        if (firstPart) entries.add(firstPart);
      }
    }

    const names = Array.from(entries);

    if (options?.withFileTypes) {
      return names.map(name => {
        const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
        const isDir = this.dirs.has(fullPath);
        return {
          name,
          isDirectory: () => isDir,
          isFile: () => !isDir,
        };
      });
    }

    return names;
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      const parts = path.split('/');
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join('/') || '/';
        this.dirs.add(dir);
      }
    } else {
      this.dirs.add(path);
    }
  }

  async stat(path: string): Promise<{ isDirectory: () => boolean; isFile: () => boolean }> {
    const isDir = this.dirs.has(path);
    const isFile = this.files.has(path);

    if (!isDir && !isFile) throw new Error(`ENOENT: ${path}`);

    return {
      isDirectory: () => isDir,
      isFile: () => isFile,
    };
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.files.delete(path);
    this.dirs.delete(path);

    if (options?.recursive) {
      const prefix = path + '/';
      for (const filePath of Array.from(this.files.keys())) {
        if (filePath.startsWith(prefix)) {
          this.files.delete(filePath);
        }
      }
      for (const dirPath of Array.from(this.dirs)) {
        if (dirPath.startsWith(prefix)) {
          this.dirs.delete(dirPath);
        }
      }
    }
  }

  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.rm(path, options);
  }

  async unlink(path: string): Promise<void> {
    this.files.delete(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const content = this.files.get(oldPath);
    if (content) {
      this.files.set(newPath, content);
      this.files.delete(oldPath);
    }
  }

  async lstat(path: string): Promise<{ isDirectory: () => boolean; isFile: () => boolean }> {
    return this.stat(path);
  }

  async readlink(_path: string): Promise<string> {
    throw new Error('Symlinks not supported in MockFS');
  }

  async symlink(_target: string, _path: string): Promise<void> {
    throw new Error('Symlinks not supported in MockFS');
  }
}

describe('skills', () => {
  let fs: MockFS;

  beforeEach(() => {
    fs = new MockFS();
  });

  describe('isValidSkillName', () => {
    it('should validate alphanumeric lowercase names with hyphens', () => {
      expect(isValidSkillName('test')).toBe(true);
      expect(isValidSkillName('test123')).toBe(true);
      expect(isValidSkillName('abc')).toBe(true);
      expect(isValidSkillName('test-name')).toBe(true);
      expect(isValidSkillName('test-123')).toBe(true);
      expect(isValidSkillName('condition-based-waiting')).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(isValidSkillName('Test')).toBe(false);
      expect(isValidSkillName('test_name')).toBe(false);
      expect(isValidSkillName('test name')).toBe(false);
      expect(isValidSkillName('Test-Name')).toBe(false);
    });
  });

  describe('getPluginSkills', () => {
    it('should return empty array when no plugins exist', async () => {
      const skills = await getPluginSkills(fs, '/plugins');
      expect(skills).toEqual([]);
    });

    it('should return skills from all plugins', async () => {
      const skillPath = '/plugins/testplugin/skills/myskill';
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        `${skillPath}/SKILL.md`,
        `---
name: myskill
description: A test skill
---

# My Skill

This is a test skill.`
      );

      const skills = await getPluginSkills(fs, '/plugins');
      expect(skills).toHaveLength(1);
      expect(skills[0]).toEqual({
        name: 'myskill',
        description: 'A test skill',
        path: skillPath,
        plugin: 'testplugin',
      });
    });

    it('should skip skills with invalid names', async () => {
      const skillPath = '/plugins/testplugin/skills/InvalidSkill';
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        `${skillPath}/SKILL.md`,
        `---
name: InvalidSkill
description: Has uppercase letters
---

Content`
      );

      const skills = await getPluginSkills(fs, '/plugins');
      expect(skills).toEqual([]);
    });

    it('should skip skills missing required frontmatter', async () => {
      const skillPath = '/plugins/testplugin/skills/incomplete';
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        `${skillPath}/SKILL.md`,
        `---
name: incomplete
---

Missing description`
      );

      const skills = await getPluginSkills(fs, '/plugins');
      expect(skills).toEqual([]);
    });
  });

  describe('getProjectSkills', () => {
    it('should get skills from project skills directory', async () => {
      const projectPath = '/projects/myproject';
      const skillPath1 = `${projectPath}/skills/skill1`;
      const skillPath2 = `${projectPath}/skills/skill2`;

      await fs.mkdir(skillPath1, { recursive: true });
      await fs.mkdir(skillPath2, { recursive: true });

      await fs.writeFile(
        `${skillPath1}/SKILL.md`,
        `---
name: project-skill-1
description: First project skill
---

Content`
      );

      await fs.writeFile(
        `${skillPath2}/SKILL.md`,
        `---
name: project-skill-2
description: Second project skill
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);

      expect(skills).toHaveLength(2);
      expect(skills[0].name).toBe('project-skill-1');
      expect(skills[0].plugin).toBe('project');
      expect(skills[1].name).toBe('project-skill-2');
      expect(skills[1].plugin).toBe('project');
    });

    it('should return empty array when project has no skills directory', async () => {
      const skills = await getProjectSkills(fs, '/projects/emptyproject');
      expect(skills).toEqual([]);
    });

    it('should skip skills with invalid names', async () => {
      const projectPath = '/projects/myproject';
      const skillPath = `${projectPath}/skills/badskill`;

      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        `${skillPath}/SKILL.md`,
        `---
name: Invalid_Skill_Name
description: This has uppercase and underscores
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);
      expect(skills).toEqual([]);
    });

    it('should check .agents/skills first', async () => {
      const projectPath = '/projects/myproject';
      const agentsSkillPath = `${projectPath}/.agents/skills/agent-skill`;
      const regularSkillPath = `${projectPath}/skills/regular-skill`;

      // Create skill in .agents/skills
      await fs.mkdir(agentsSkillPath, { recursive: true });
      await fs.writeFile(
        `${agentsSkillPath}/SKILL.md`,
        `---
name: agent-skill
description: Skill from .agents/skills
---

Content`
      );

      // Create skill in skills directory (should be ignored)
      await fs.mkdir(regularSkillPath, { recursive: true });
      await fs.writeFile(
        `${regularSkillPath}/SKILL.md`,
        `---
name: regular-skill
description: Skill from skills directory
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('agent-skill');
      expect(skills[0].description).toBe('Skill from .agents/skills');
    });

    it('should check .opencode/skills second', async () => {
      const projectPath = '/projects/myproject';
      const opencodeSkillPath = `${projectPath}/.opencode/skills/opencode-skill`;
      const regularSkillPath = `${projectPath}/skills/regular-skill`;

      // Create skill in .opencode/skills
      await fs.mkdir(opencodeSkillPath, { recursive: true });
      await fs.writeFile(
        `${opencodeSkillPath}/SKILL.md`,
        `---
name: opencode-skill
description: Skill from .opencode/skills
---

Content`
      );

      // Create skill in skills directory (should be ignored)
      await fs.mkdir(regularSkillPath, { recursive: true });
      await fs.writeFile(
        `${regularSkillPath}/SKILL.md`,
        `---
name: regular-skill
description: Skill from skills directory
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('opencode-skill');
      expect(skills[0].description).toBe('Skill from .opencode/skills');
    });

    it('should check .claude/skills third', async () => {
      const projectPath = '/projects/myproject';
      const claudeSkillPath = `${projectPath}/.claude/skills/claude-skill`;
      const regularSkillPath = `${projectPath}/skills/regular-skill`;

      // Create skill in .claude/skills
      await fs.mkdir(claudeSkillPath, { recursive: true });
      await fs.writeFile(
        `${claudeSkillPath}/SKILL.md`,
        `---
name: claude-skill
description: Skill from .claude/skills
---

Content`
      );

      // Create skill in skills directory (should be ignored)
      await fs.mkdir(regularSkillPath, { recursive: true });
      await fs.writeFile(
        `${regularSkillPath}/SKILL.md`,
        `---
name: regular-skill
description: Skill from skills directory
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('claude-skill');
      expect(skills[0].description).toBe('Skill from .claude/skills');
    });

    it('should fall back to skills directory if no other directories exist', async () => {
      const projectPath = '/projects/myproject';
      const regularSkillPath = `${projectPath}/skills/regular-skill`;

      // Create skill in skills directory only
      await fs.mkdir(regularSkillPath, { recursive: true });
      await fs.writeFile(
        `${regularSkillPath}/SKILL.md`,
        `---
name: regular-skill
description: Skill from skills directory
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('regular-skill');
      expect(skills[0].description).toBe('Skill from skills directory');
    });

    it('should prioritize .agents/skills over .opencode/skills', async () => {
      const projectPath = '/projects/myproject';
      const agentsSkillPath = `${projectPath}/.agents/skills/agent-skill`;
      const opencodeSkillPath = `${projectPath}/.opencode/skills/opencode-skill`;

      // Create skill in .agents/skills
      await fs.mkdir(agentsSkillPath, { recursive: true });
      await fs.writeFile(
        `${agentsSkillPath}/SKILL.md`,
        `---
name: agent-skill
description: Skill from .agents/skills
---

Content`
      );

      // Create skill in .opencode/skills (should be ignored)
      await fs.mkdir(opencodeSkillPath, { recursive: true });
      await fs.writeFile(
        `${opencodeSkillPath}/SKILL.md`,
        `---
name: opencode-skill
description: Skill from .opencode/skills
---

Content`
      );

      const skills = await getProjectSkills(fs, projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('agent-skill');
      expect(skills[0].description).toBe('Skill from .agents/skills');
    });
  });

  describe('getAllSkills', () => {
    it('should combine plugin and project skills', async () => {
      const pluginPath = '/plugins/testplugin/skills/pluginskill';
      const projectPath = '/projects/myproject';
      const projectSkillPath = `${projectPath}/skills/projectskill`;

      // Create plugin skill
      await fs.mkdir(pluginPath, { recursive: true });
      await fs.writeFile(
        `${pluginPath}/SKILL.md`,
        `---
name: plugin-skill
description: A plugin skill
---

Content`
      );

      // Create project skill
      await fs.mkdir(projectSkillPath, { recursive: true });
      await fs.writeFile(
        `${projectSkillPath}/SKILL.md`,
        `---
name: project-skill
description: A project skill
---

Content`
      );

      const skills = await getAllSkills(fs, '/plugins', projectPath);

      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain('plugin-skill');
      expect(skills.map((s) => s.name)).toContain('project-skill');
    });

    it('should give precedence to project skills over plugin skills with same name', async () => {
      const pluginPath = '/plugins/testplugin/skills/samename';
      const projectPath = '/projects/myproject';
      const projectSkillPath = `${projectPath}/skills/samename`;

      // Create plugin skill
      await fs.mkdir(pluginPath, { recursive: true });
      await fs.writeFile(
        `${pluginPath}/SKILL.md`,
        `---
name: same-name
description: Plugin version
---

Plugin content`
      );

      // Create project skill with same name
      await fs.mkdir(projectSkillPath, { recursive: true });
      await fs.writeFile(
        `${projectSkillPath}/SKILL.md`,
        `---
name: same-name
description: Project version
---

Project content`
      );

      const skills = await getAllSkills(fs, '/plugins', projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('same-name');
      expect(skills[0].description).toBe('Project version');
      expect(skills[0].plugin).toBe('project');
    });

    it('should return only plugin skills when project has no skills', async () => {
      const pluginPath = '/plugins/testplugin/skills/pluginskill';

      await fs.mkdir(pluginPath, { recursive: true });
      await fs.writeFile(
        `${pluginPath}/SKILL.md`,
        `---
name: plugin-skill
description: A plugin skill
---

Content`
      );

      const skills = await getAllSkills(fs, '/plugins', '/projects/emptyproject');

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('plugin-skill');
      expect(skills[0].plugin).toBe('testplugin');
    });

    it('should return only project skills when there are no plugins', async () => {
      const projectPath = '/projects/myproject';
      const projectSkillPath = `${projectPath}/skills/projectskill`;

      await fs.mkdir(projectSkillPath, { recursive: true });
      await fs.writeFile(
        `${projectSkillPath}/SKILL.md`,
        `---
name: project-skill
description: A project skill
---

Content`
      );

      const skills = await getAllSkills(fs, '/empty-plugins', projectPath);

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('project-skill');
      expect(skills[0].plugin).toBe('project');
    });
  });

  describe('findSkill', () => {
    it('should find a plugin skill by name', async () => {
      const skillPath = '/plugins/testplugin/skills/findme';
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        `${skillPath}/SKILL.md`,
        `---
name: findme
description: Find this skill
---

Content`
      );

      const skill = await findSkill(fs, '/plugins', '/projects/myproject', 'findme');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('findme');
      expect(skill?.plugin).toBe('testplugin');
    });

    it('should find a project skill by name', async () => {
      const projectPath = '/projects/myproject';
      const skillPath = `${projectPath}/skills/projectskill`;
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        `${skillPath}/SKILL.md`,
        `---
name: projectskill
description: A project skill
---

Content`
      );

      const skill = await findSkill(fs, '/plugins', projectPath, 'projectskill');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('projectskill');
      expect(skill?.plugin).toBe('project');
    });

    it('should prefer project skill over plugin skill with same name', async () => {
      const pluginPath = '/plugins/testplugin/skills/samename';
      const projectPath = '/projects/myproject';
      const projectSkillPath = `${projectPath}/skills/samename`;

      // Create plugin skill
      await fs.mkdir(pluginPath, { recursive: true });
      await fs.writeFile(
        `${pluginPath}/SKILL.md`,
        `---
name: samename
description: Plugin version
---

Plugin content`
      );

      // Create project skill with same name
      await fs.mkdir(projectSkillPath, { recursive: true });
      await fs.writeFile(
        `${projectSkillPath}/SKILL.md`,
        `---
name: samename
description: Project version
---

Project content`
      );

      const skill = await findSkill(fs, '/plugins', projectPath, 'samename');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('samename');
      expect(skill?.description).toBe('Project version');
      expect(skill?.plugin).toBe('project');
    });

    it('should return null when skill not found in either plugins or project', async () => {
      const skill = await findSkill(fs, '/plugins', '/projects/myproject', 'nonexistent');
      expect(skill).toBeNull();
    });
  });

  describe('readSkillContent', () => {
    it('should read the full SKILL.md content', async () => {
      const skillPath = '/plugins/testplugin/skills/myskill';
      await fs.mkdir(skillPath, { recursive: true });
      const content = `---
name: myskill
description: A test skill
---

# My Skill

This is the skill content.`;

      await fs.writeFile(`${skillPath}/SKILL.md`, content);

      const skill = {
        name: 'myskill',
        description: 'A test skill',
        path: skillPath,
        plugin: 'testplugin',
      };

      const readContent = await readSkillContent(fs, skill);
      expect(readContent).toBe(content);
    });
  });
});
