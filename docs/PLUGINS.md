# Shakespeare Plugins System

Shakespeare now includes a comprehensive plugins system that allows you to extend the AI's capabilities with reusable skills.

## Overview

Plugins are Git repositories that can contain **skills** - specialized AI workflows that help the AI assistant perform specific tasks more effectively. Skills are automatically discovered and made available to the AI through the `skill` tool.

## Features

- **Git-based plugins**: Clone plugins from any Git repository (GitHub, GitLab, etc.)
- **Automatic skill discovery**: Skills are automatically found and registered from all installed plugins
- **Configurable storage**: Plugin directory is configurable in System Settings
- **Sync support**: Pull latest changes from plugin repositories
- **Delete support**: Remove plugins when no longer needed
- **AI integration**: Skills are automatically included in the system prompt and accessible via the `skill` tool

## User Interface

### AI Settings Page (`/settings/ai`)

The AI Settings page now includes a **Plugins** section with:

1. **Add Plugin**: Clone a new plugin by entering its Git URL
2. **Plugin List**: View all installed plugins with their skills
3. **Sync**: Pull latest changes from a plugin's Git repository
4. **Delete**: Remove a plugin and all its skills

### System Settings Page (`/settings/system`)

The System Settings page includes a **Filesystem Paths** section where you can configure:

- **Plugins Directory**: Path where plugins are stored (default: `/plugins`)

## Plugin Structure

A plugin is a Git repository with the following structure:

```
my-plugin/
├── skills/
│   ├── skill1/
│   │   └── SKILL.md
│   ├── skill2/
│   │   └── SKILL.md
│   └── ...
└── README.md (optional)
```

### Skill Format

Each skill is defined by a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skillname
description: A brief description of what this skill does
---

# Skill Content

The rest of the file contains instructions, examples, and context
that will be provided to the AI when this skill is invoked.

This can include:
- Step-by-step workflows
- Code examples
- Best practices
- Domain-specific knowledge
```

#### Required Frontmatter Fields

- **`name`**: Skill identifier (must be lowercase alphanumeric with hyphens, e.g., `myskill`, `skill-123`, `condition-based-waiting`)
- **`description`**: Human-readable description of what the skill does

#### Skill Name Validation

Skill names must:
- Contain only lowercase letters (a-z), numbers (0-9), and hyphens (-)
- No spaces, underscores, uppercase letters, or other special characters
- Examples: ✅ `myskill`, `skill-123`, `condition-based-waiting` | ❌ `My-Skill`, `skill_name`, `SKILL`

## How It Works

### For Users

1. **Add a Plugin**:
   - Go to Settings > AI
   - Scroll to the Plugins section
   - Click "Add Plugin"
   - Enter the Git URL (e.g., `https://github.com/user/shakespeare-skills.git`)
   - Click "Add Plugin"

2. **View Skills**:
   - Installed plugins show the number of skills they contain
   - Expand a plugin to see all its skills with descriptions

3. **Sync a Plugin**:
   - Click the "Sync" button next to a plugin to pull latest changes
   - Useful when the plugin repository is updated with new skills

4. **Delete a Plugin**:
   - Click the "Delete" button next to a plugin to remove it
   - All skills from that plugin will no longer be available

### For the AI

The AI assistant automatically:

1. **Discovers Skills**: All skills from installed plugins are scanned on startup
2. **Includes in System Prompt**: Skills are listed in the system prompt with their names, descriptions, and paths
3. **Enforces Usage**: The system prompt instructs the AI to use skills whenever applicable
4. **Accesses via Tool**: The AI calls the `skill` tool with a skill name to load its content

Example AI workflow:
```
User: "Help me build a Nostr marketplace"

AI: [Sees "nostrmarket" skill in system prompt]
    [Calls skill tool with name="nostrmarket"]
    [Receives SKILL.md content with marketplace implementation guide]
    [Follows the skill's instructions to build the marketplace]
```

## Technical Implementation

### Key Files

- **`src/lib/plugins.ts`**: Core plugin and skill management functions
- **`src/lib/tools/SkillTool.ts`**: AI tool for loading skill content
- **`src/hooks/usePlugins.ts`**: React hook for plugin CRUD operations
- **`src/components/PluginsSection.tsx`**: UI component for managing plugins
- **`src/lib/system.ts`**: Updated to include skills in system prompt

### API

#### `getPlugins(fs, pluginsPath)`
Returns array of plugin names (directory basenames).

#### `getAllSkills(fs, pluginsPath)`
Returns array of all skills from all plugins.

#### `findSkill(fs, pluginsPath, skillName)`
Finds a skill by name across all plugins.

#### `readSkillContent(fs, skill)`
Reads the SKILL.md content for a skill.

#### `deletePlugin(fs, pluginsPath, pluginName)`
Recursively deletes a plugin directory.

### Skill Tool

The `SkillTool` is exposed to the AI as the `skill` function:

```typescript
{
  name: "skill",
  description: "Load and execute a skill from the configured plugins",
  parameters: {
    name: "The name of the skill to execute"
  }
}
```

When called, it:
1. Searches all plugins for a skill with the matching name
2. Returns the full SKILL.md content
3. Includes metadata (plugin name, description, path)

### Storage

Plugins are stored in the configured plugins directory:

- **Browser**: `/plugins` (IndexedDB via LightningFS)
- **Electron (Windows)**: `~/AppData/Local/shakespeare/plugins`
- **Electron (macOS)**: `~/Library/Application Support/shakespeare/plugins`
- **Electron (Linux)**: `~/.config/shakespeare/plugins`

## System Prompt Integration

The system prompt now includes a **Skills** section that:

1. Lists all available skills with their names, descriptions, plugins, and paths
2. Instructs the AI to use skills whenever applicable
3. Provides the Settings > AI URL for users to configure skills
4. Includes this section even when no skills are configured (to inform users about the feature)

Example system prompt section:

```
## Skills

You have access to the following skills. **Skills MUST be used whenever applicable** by calling the `skill` tool with the skill name.

Available skills:

- **nostrmarket**: Build a Nostr marketplace application
  - Plugin: nostr-skills
  - Path: /plugins/nostr-skills/skills/nostrmarket

**Important**: When a task matches a skill's description, you MUST use that skill by calling the skill tool. Skills contain specialized workflows and best practices for specific tasks.

Users can configure skills in Settings > AI (https://shakespeare.diy/settings/ai) by adding plugins that contain skills.
```

## Creating Your Own Plugin

1. **Create a Git repository** with the plugin structure
2. **Add skills** in the `skills/` directory
3. **Write SKILL.md files** with frontmatter and content
4. **Push to GitHub/GitLab** or any Git hosting service
5. **Share the Git URL** with others to install your plugin

### Example Plugin Repository

```
my-shakespeare-skills/
├── README.md
└── skills/
    ├── webdesign/
    │   └── SKILL.md
    └── database/
        └── SKILL.md
```

**skills/webdesign/SKILL.md**:
```markdown
---
name: webdesign
description: Create beautiful, modern web designs with best practices
---

# Web Design Skill

When designing web interfaces, follow these principles:

1. **Use a consistent color palette** (3-5 colors + neutrals)
2. **Implement proper spacing** (8px grid system)
3. **Choose readable fonts** (18px+ for body text)
4. **Ensure accessibility** (WCAG 2.1 AA compliance)

[... detailed instructions ...]
```

## Configuration

### Plugins Directory Path

Configure in **Settings > System > Filesystem Paths**:

- Default browser: `/plugins`
- Default Electron: OS-specific (see Storage section)
- Custom: Any absolute path

Changes take effect immediately.

## Limitations

- Plugins must be Git repositories (no ZIP uploads)
- Skills must be in `skills/` subdirectory
- Skill names must be alphanumeric lowercase only
- Each skill must have a `SKILL.md` file with required frontmatter
- No automatic skill updates (users must manually sync)

## Future Enhancements

Potential future features:

- Plugin marketplace/registry
- Automatic skill updates
- Skill versioning
- Skill dependencies
- Plugin configuration files
- Skill categories/tags
- Skill search functionality
- Plugin publishing workflow
