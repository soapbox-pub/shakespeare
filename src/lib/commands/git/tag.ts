import git from 'isomorphic-git';
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand } from "../git";

export class GitTagCommand implements GitSubcommand {
  name = 'tag';
  description = 'Create, list, delete or verify a tag object';
  usage = 'git tag [-l] | git tag <tagname> [<commit>] | git tag -d <tagname>';

  async execute(args: string[], cwd: string, fs: JSRuntimeFS): Promise<ShellCommandResult> {
    try {
      // Check if we're in a git repository
      try {
        await fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const { action, tagName, commit } = this.parseArgs(args);

      switch (action) {
        case 'list':
          return await this.listTags(fs, cwd);
        case 'create':
          return await this.createTag(fs, cwd, tagName!, commit);
        case 'delete':
          return await this.deleteTag(fs, cwd, tagName!);
        default:
          return await this.listTags(fs, cwd);
      }

    } catch (error) {
      return createErrorResult(`git tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseArgs(args: string[]): {
    action: 'list' | 'create' | 'delete';
    tagName?: string;
    commit?: string;
    options: { annotated: boolean }
  } {
    const options = { annotated: false };
    let action: 'list' | 'create' | 'delete' = 'list';
    let tagName: string | undefined;
    let commit: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '-l' || arg === '--list') {
        action = 'list';
      } else if (arg === '-d' || arg === '--delete') {
        action = 'delete';
        if (i + 1 < args.length) {
          tagName = args[i + 1];
          i++;
        }
      } else if (arg === '-a' || arg === '--annotate') {
        options.annotated = true;
      } else if (!arg.startsWith('-')) {
        if (!tagName) {
          tagName = arg;
          action = 'create';
        } else if (!commit) {
          commit = arg;
        }
      }
    }

    return { action, tagName, commit, options };
  }

  private async listTags(fs: JSRuntimeFS, cwd: string): Promise<ShellCommandResult> {
    try {
      const tags = await git.listTags({
        fs,
        dir: cwd,
      });

      if (tags.length === 0) {
        return createSuccessResult('');
      }

      // Sort tags alphabetically
      tags.sort();

      return createSuccessResult(tags.join('\n') + '\n');

    } catch (error) {
      return createErrorResult(`Failed to list tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createTag(fs: JSRuntimeFS, cwd: string, tagName: string, commit?: string): Promise<ShellCommandResult> {
    try {
      if (!tagName) {
        return createErrorResult('usage: git tag <tagname> [<commit>]');
      }

      // Check if tag already exists
      try {
        const tags = await git.listTags({
          fs,
          dir: cwd,
        });

        if (tags.includes(tagName)) {
          return createErrorResult(`fatal: tag '${tagName}' already exists`);
        }
      } catch {
        // Continue if we can't list tags
      }

      // Resolve the target commit
      let targetOid: string;
      try {
        targetOid = await git.resolveRef({
          fs,
          dir: cwd,
          ref: commit || 'HEAD',
        });
      } catch {
        return createErrorResult(`fatal: not a valid object name: '${commit || 'HEAD'}'`);
      }

      // Create the tag
      await git.tag({
        fs,
        dir: cwd,
        ref: tagName,
        object: targetOid,
      });

      return createSuccessResult('');

    } catch (error) {
      return createErrorResult(`Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async deleteTag(fs: JSRuntimeFS, cwd: string, tagName: string): Promise<ShellCommandResult> {
    try {
      if (!tagName) {
        return createErrorResult('usage: git tag -d <tagname>');
      }

      // Check if tag exists
      try {
        const tags = await git.listTags({
          fs,
          dir: cwd,
        });

        if (!tags.includes(tagName)) {
          return createErrorResult(`error: tag '${tagName}' not found.`);
        }
      } catch {
        return createErrorResult(`error: tag '${tagName}' not found.`);
      }

      // Delete the tag
      await git.deleteTag({
        fs,
        dir: cwd,
        ref: tagName,
      });

      return createSuccessResult(`Deleted tag '${tagName}'\n`);

    } catch (error) {
      return createErrorResult(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}