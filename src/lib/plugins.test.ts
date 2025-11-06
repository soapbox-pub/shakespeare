import { describe, it, expect, beforeEach } from 'vitest';
import { LightningFSAdapter } from './LightningFSAdapter';
import LightningFS from '@isomorphic-git/lightning-fs';
import {
  getPlugins,
  getPluginSkills,
  getAllSkills,
  findSkill,
  readSkillContent,
  isValidSkillName,
} from './plugins';

describe('plugins', () => {
  let fs: LightningFSAdapter;

  beforeEach(() => {
    const lightningFS = new LightningFS('test-plugins-fs');
    fs = new LightningFSAdapter(lightningFS.promises);
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
