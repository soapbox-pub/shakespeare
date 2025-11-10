import { describe, it, expect, beforeEach } from 'vitest';
import type { JSRuntimeFS } from './JSRuntime';
import {
  getPlugins,
  getPluginSkills,
  getAllSkills,
  findSkill,
  readSkillContent,
  isValidSkillName,
} from './plugins';

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

  async readdir(path: string): Promise<string[]> {
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

    return Array.from(entries);
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
}

describe('plugins', () => {
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

  describe('getPlugins', () => {
    it('should return empty array when plugins directory does not exist', async () => {
      const plugins = await getPlugins(fs, '/plugins');
      expect(plugins).toEqual([]);
    });

    it('should return list of plugin directories', async () => {
      await fs.mkdir('/plugins/plugin1', { recursive: true });
      await fs.mkdir('/plugins/plugin2', { recursive: true });
      await fs.writeFile('/plugins/file.txt', 'not a directory');

      const plugins = await getPlugins(fs, '/plugins');
      expect(plugins).toContain('plugin1');
      expect(plugins).toContain('plugin2');
      expect(plugins).not.toContain('file.txt');
    });
  });

  describe('getPluginSkills', () => {
    it('should return empty array when plugin has no skills', async () => {
      await fs.mkdir('/plugins/plugin1', { recursive: true });

      const skills = await getPluginSkills(fs, '/plugins', 'plugin1');
      expect(skills).toEqual([]);
    });

    it('should return skills with valid SKILL.md files', async () => {
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

      const skills = await getPluginSkills(fs, '/plugins', 'testplugin');
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

      const skills = await getPluginSkills(fs, '/plugins', 'testplugin');
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

      const skills = await getPluginSkills(fs, '/plugins', 'testplugin');
      expect(skills).toEqual([]);
    });
  });

  describe('getAllSkills', () => {
    it('should return skills from all plugins', async () => {
      // Plugin 1
      const skill1Path = '/plugins/plugin1/skills/skill1';
      await fs.mkdir(skill1Path, { recursive: true });
      await fs.writeFile(
        `${skill1Path}/SKILL.md`,
        `---
name: skill1
description: First skill
---

Content`
      );

      // Plugin 2
      const skill2Path = '/plugins/plugin2/skills/skill2';
      await fs.mkdir(skill2Path, { recursive: true });
      await fs.writeFile(
        `${skill2Path}/SKILL.md`,
        `---
name: skill2
description: Second skill
---

Content`
      );

      const skills = await getAllSkills(fs, '/plugins');
      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain('skill1');
      expect(skills.map((s) => s.name)).toContain('skill2');
    });
  });

  describe('findSkill', () => {
    it('should find a skill by name', async () => {
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

      const skill = await findSkill(fs, '/plugins', 'findme');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('findme');
    });

    it('should return null when skill not found', async () => {
      const skill = await findSkill(fs, '/plugins', 'nonexistent');
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
