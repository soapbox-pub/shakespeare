import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSystemPrompt, MakeSystemPromptOpts } from './system';
import { JSRuntimeFS } from './JSRuntime';
import { NUser } from '@nostrify/react/login';
import { NostrMetadata } from '@nostrify/nostrify';
import { AppConfig } from '@/contexts/AppContext';
import OpenAI from 'openai';

// Mock the plugins module
vi.mock('./plugins', () => ({
  getAllSkills: vi.fn(),
}));

// Mock path-browserify
vi.mock('path-browserify', () => ({
  join: (...args: string[]) => args.join('/').replace(/\/+/g, '/'),
}));

import { getAllSkills } from './plugins';

// Test configuration
const testConfig: AppConfig = {
  theme: 'light',
  relayMetadata: {
    relays: [
      { url: 'wss://relay.nostr.band', read: true, write: true },
    ],
    updatedAt: 0,
  },
  projectTemplate: 'https://gitlab.com/soapbox-pub/mkstack.git',
  esmUrl: 'https://esm.shakespeare.diy',
  corsProxy: 'https://proxy.shakespeare.diy/?url={href}',
  faviconUrl: 'https://external-content.duckduckgo.com/ip3/{hostname}.ico',
  previewDomain: 'local-shakespeare.dev',
  language: 'en',
  showcaseEnabled: true,
  showcaseModerator: 'npub1jvnpg4c6ljadf5t6ry0w9q0rnm4mksde87kglkrc993z46c39axsgq89sc',
  ngitServers: ['git.shakespeare.diy', 'relay.ngit.dev'],
  fsPathProjects: '/projects',
  fsPathConfig: '/config',
  fsPathTmp: '/tmp',
  fsPathPlugins: '/plugins',
  sentryDsn: '',
  sentryEnabled: false,
};

describe('makeSystemPrompt', () => {
  let mockFs: JSRuntimeFS;
  let baseOpts: MakeSystemPromptOpts;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock filesystem
    mockFs = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      mkdir: vi.fn(),
      rmdir: vi.fn(),
      unlink: vi.fn(),
      rename: vi.fn(),
      exists: vi.fn(),
    } as unknown as JSRuntimeFS;

    // Base options for tests
    baseOpts = {
      tools: [],
      mode: 'agent',
      fs: mockFs,
      cwd: '/projects/test-project',
      config: testConfig,
      defaultConfig: testConfig,
    };

    // Mock getAllSkills to return empty array by default
    vi.mocked(getAllSkills).mockResolvedValue([]);
  });

  describe('basic system prompt generation', () => {
    it('should generate a basic system prompt in agent mode', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('You are Shakespeare, an expert software extraordinaire');
      expect(result).toContain('Your goal is to work on the project in the current directory');
      expect(result).toContain('explore and understand the project structure');
    });

    it('should generate a basic system prompt in init mode', async () => {
      const result = await makeSystemPrompt({ ...baseOpts, mode: 'init' });

      expect(result).toContain('You are Shakespeare, an expert software extraordinaire');
      expect(result).toContain('The files in the current directory are a template');
      expect(result).toContain('transform this template into a working project');
    });

    it('should include current date', async () => {
      const result = await makeSystemPrompt(baseOpts);

      const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      expect(result).toContain(`**Current Date**: ${currentDate}`);
    });

    it('should include current working directory', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('**Current Working Directory**: /projects/test-project');
    });
  });

  describe('user information', () => {
    it('should include logged-out user message when no user is provided', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('The user is not logged in');
      expect(result).toContain('can log into Nostr by clicking the "Login" button');
    });

    it('should include basic user information when user is provided', async () => {
      const user = new NUser(
        'extension',
        'abc123def456',
        {} as NUser['signer']
      );

      const result = await makeSystemPrompt({ ...baseOpts, user });

      expect(result).toContain('The user is logged into Nostr');
      expect(result).toContain('**Nostr pubkey (hex)**: abc123def456');
      expect(result).toContain('**Nostr npub**: npub1');
    });

    it('should include user metadata when provided', async () => {
      const user = new NUser(
        'extension',
        'abc123def456',
        {} as NUser['signer']
      );

      const metadata: NostrMetadata = {
        name: 'Alice',
        about: 'A passionate developer',
        website: 'https://alice.example.com',
        picture: 'https://alice.example.com/avatar.jpg',
        banner: 'https://alice.example.com/banner.jpg',
        nip05: 'alice@example.com',
        lud16: 'alice@getalby.com',
      };

      const result = await makeSystemPrompt({ ...baseOpts, user, metadata });

      expect(result).toContain('**Name**: Alice');
      expect(result).toContain('**About**: A passionate developer');
      expect(result).toContain('**Website**: https://alice.example.com');
      expect(result).toContain('**Avatar**: https://alice.example.com/avatar.jpg');
      expect(result).toContain('**Banner**: https://alice.example.com/banner.jpg');
      expect(result).toContain('**NIP-05**: alice@example.com');
      expect(result).toContain('**Lightning Address**: alice@getalby.com');
    });

    it('should sanitize multiline about text', async () => {
      const user = new NUser(
        'extension',
        'abc123def456',
        {} as NUser['signer']
      );

      const metadata: NostrMetadata = {
        about: 'Line 1\nLine 2\r\nLine 3',
      };

      const result = await makeSystemPrompt({ ...baseOpts, user, metadata });

      expect(result).toContain('**About**: Line 1 Line 2 Line 3');
      expect(result).not.toContain('\n**About**');
    });
  });

  describe('tools section', () => {
    it('should not include tools section when no tools are provided', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).not.toContain('## Available Tools');
    });

    it('should list available tools with descriptions', async () => {
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read contents of a file',
            parameters: {},
          },
        },
        {
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write contents to a file',
            parameters: {},
          },
        },
      ];

      const result = await makeSystemPrompt({ ...baseOpts, tools });

      expect(result).toContain('## Available Tools');
      expect(result).toContain('**read_file**: Read contents of a file');
      expect(result).toContain('**write_file**: Write contents to a file');
    });

    it('should handle tools without descriptions', async () => {
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'some_tool',
            parameters: {},
          },
        },
      ];

      const result = await makeSystemPrompt({ ...baseOpts, tools });

      expect(result).toContain('**some_tool**: No description available');
    });
  });

  describe('skills section', () => {
    it('should show no skills message when pluginsPath is not provided', async () => {
      const result = await makeSystemPrompt({
        ...baseOpts,
        config: { ...testConfig, fsPathPlugins: '' },
      });

      expect(result).toContain('## Skills');
      expect(result).toContain('No skills are currently configured');
    });

    it('should show no skills message when getAllSkills returns empty array', async () => {
      vi.mocked(getAllSkills).mockResolvedValue([]);

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('No skills are currently configured');
      expect(getAllSkills).toHaveBeenCalledWith(mockFs, '/plugins');
    });

    it('should list available skills when they exist', async () => {
      vi.mocked(getAllSkills).mockResolvedValue([
        {
          name: 'create_component',
          description: 'Create a new React component',
          plugin: 'react-plugin',
          path: '/plugins/react-plugin/skills/create_component.md',
        },
        {
          name: 'setup_routing',
          description: 'Setup React Router',
          plugin: 'react-plugin',
          path: '/plugins/react-plugin/skills/setup_routing.md',
        },
      ]);

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('## Skills');
      expect(result).toContain('**create_component**: Create a new React component');
      expect(result).toContain('Plugin: react-plugin');
      expect(result).toContain('**setup_routing**: Setup React Router');
      expect(result).toContain('Skills MUST be used whenever applicable');
    });

    it('should handle getAllSkills errors gracefully', async () => {
      vi.mocked(getAllSkills).mockRejectedValue(new Error('Plugin error'));

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('No skills are currently configured');
    });
  });

  describe('CORS proxy section', () => {
    it('should not include CORS proxy section when not provided', async () => {
      const result = await makeSystemPrompt({
        ...baseOpts,
        config: { ...testConfig, corsProxy: '' },
      });

      expect(result).not.toContain('## Working Around CORS Issues');
    });

    it('should include CORS proxy information when provided', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('## Working Around CORS Issues');
      expect(result).toContain('**CORS Proxy URL Template**: `https://proxy.shakespeare.diy/?url={href}`');
    });
  });

  describe('Edit with Shakespeare section', () => {
    it('should show message when no repository URL is configured', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('## Edit with Shakespeare');
      expect(result).toContain('This project does not currently have a repository URL configured');
    });

    it('should include badge code snippets when repository URL is provided', async () => {
      const result = await makeSystemPrompt({
        ...baseOpts,
        repositoryUrl: 'https://github.com/user/repo.git',
      });

      expect(result).toContain('## Edit with Shakespeare');
      expect(result).toContain('[![Edit with Shakespeare]');
      expect(result).toContain('/badge.svg');
      expect(result).toContain('/clone');
      // URL is encoded, so check for the encoded version
      expect(result).toContain('url=https%3A%2F%2Fgithub.com%2Fuser%2Frepo.git');
    });
  });

  describe('README.md inclusion', () => {
    it('should include README.md content when it exists', async () => {
      vi.mocked(mockFs.readFile).mockImplementation(async (path: string) => {
        if (path === '/projects/test-project/README.md') {
          return '# My Project\n\nThis is a test project.';
        }
        throw new Error('File not found');
      });

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('# My Project');
      expect(result).toContain('This is a test project.');
    });

    it('should continue when README.md does not exist', async () => {
      vi.mocked(mockFs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toBeTruthy();
      expect(result).not.toContain('# My Project');
    });
  });

  describe('AGENTS.md and context files inclusion', () => {
    it('should include AGENTS.md content when it exists', async () => {
      vi.mocked(mockFs.readFile).mockImplementation(async (path: string) => {
        if (path === '/projects/test-project/AGENTS.md') {
          return '# Agent Instructions\n\nFollow these guidelines.';
        }
        throw new Error('File not found');
      });

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('# Agent Instructions');
      expect(result).toContain('Follow these guidelines.');
    });

    it('should try alternative context files in order', async () => {
      vi.mocked(mockFs.readFile).mockImplementation(async (path: string) => {
        if (path === '/projects/test-project/CONTEXT.md') {
          return '# Context File\n\nProject context.';
        }
        throw new Error('File not found');
      });

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('# Context File');
      expect(result).toContain('Project context.');
    });

    it('should continue when no context files exist', async () => {
      vi.mocked(mockFs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await makeSystemPrompt(baseOpts);

      expect(result).toBeTruthy();
    });

    it('should try context files in correct order', async () => {
      const readFileCalls: string[] = [];

      vi.mocked(mockFs.readFile).mockImplementation(async (path: string) => {
        readFileCalls.push(path);
        throw new Error('File not found');
      });

      await makeSystemPrompt(baseOpts);

      // Check that AGENTS.md is tried first
      expect(readFileCalls).toContain('/projects/test-project/AGENTS.md');
    });
  });

  describe('complete system prompt structure', () => {
    it('should include all major sections', async () => {
      // Use a valid hex pubkey (64 characters)
      const validPubkey = '0'.repeat(64);
      const user = new NUser('extension', validPubkey, {} as NUser['signer']);
      const result = await makeSystemPrompt({
        ...baseOpts,
        user,
        repositoryUrl: 'https://github.com/test/repo.git',
      });

      expect(result).toContain('# Your Environment');
      expect(result).toContain('## What Shakespeare Is');
      expect(result).toContain('## The User');
      expect(result).toContain('## User Interface');
      expect(result).toContain('## User Actions');
      expect(result).toContain('## Virtual Filesystem Structure');
      expect(result).toContain('## Your Role');
      expect(result).toContain('## Skills');
      expect(result).toContain('## Working Around CORS Issues');
      expect(result).toContain('## Edit with Shakespeare');
    });

    it('should include Shakespeare architecture information', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('Browser-Based Storage');
      expect(result).toContain('AI Provider Independence');
      expect(result).toContain('Shakespeare AI Credits');
      expect(result).toContain('Cross-Browser Access');
      expect(result).toContain('No Central Shakespeare Server');
    });

    it('should include user interface description', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('**Homepage**');
      expect(result).toContain('**Project View**');
      expect(result).toContain('**Settings**');
      expect(result).toContain('**Left Pane**: AI chat interface');
      expect(result).toContain('**Right Pane**: Toggles between two views');
    });

    it('should include virtual filesystem structure', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('/projects/');
      // The config/ and tmp/ paths are in a code block, so check for the exact format
      expect(result).toContain('├── config/');
      expect(result).toContain('└── tmp/');
      expect(result).toContain('Project Isolation');
      expect(result).toContain('Persistent Storage');
    });

    it('should include role description with commit reminder', async () => {
      const result = await makeSystemPrompt(baseOpts);

      expect(result).toContain('## Your Role');
      expect(result).toContain('Always commit your code changes');
    });
  });

  describe('custom template support', () => {
    it('should render a custom template when provided', async () => {
      const customTemplate = `Hello Shakespeare! Current directory: <%= ctx.cwd %>`;

      const result = await makeSystemPrompt({
        ...baseOpts,
        template: customTemplate,
      });

      expect(result).toContain('Hello Shakespeare!');
      expect(result).toContain('Current directory: /projects/test-project');
      expect(result).not.toContain('# Your Environment'); // Should not include default template content
    });

    it('should support conditional logic in custom templates', async () => {
      const customTemplate = `<% if (ctx.mode === 'init') { %>Initializing...<% } else { %>Working on project<% } %>`;

      const result = await makeSystemPrompt({
        ...baseOpts,
        mode: 'agent',
        template: customTemplate,
      });

      expect(result).toContain('Working on project');
      expect(result).not.toContain('Initializing');
    });

    it('should provide access to all context variables in custom templates', async () => {
      const user = new NUser(
        'extension',
        'abc123def456',
        {} as NUser['signer']
      );

      const customTemplate = `User: <%= ctx.user?.pubkey || 'none' %>
CWD: <%= ctx.cwd %>
Origin: <%= ctx.originUrl %>
Skills: <%= ctx.skills.length %>`;

      const result = await makeSystemPrompt({
        ...baseOpts,
        user,
        template: customTemplate,
      });

      expect(result).toContain('User: abc123def456');
      expect(result).toContain('CWD: /projects/test-project');
      expect(result).toContain('Origin: http://localhost:3000');
      expect(result).toContain('Skills: 0');
    });
  });
});
