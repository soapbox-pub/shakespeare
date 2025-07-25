import { z } from "zod";
import git from 'isomorphic-git';

import type { Tool, CallToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface GitCommitParams {
  message: string;
}

export class GitCommitTool implements Tool<GitCommitParams> {
  private fs: JSRuntimeFS;
  private cwd: string;

  readonly description = "Commit changes to git with a commit message. Automatically adds all unstaged files.";

  readonly parameters = z.object({
    message: z.string().describe('Commit message text'),
  });

  constructor(fs: JSRuntimeFS, cwd: string) {
    this.fs = fs;
    this.cwd = cwd;
  }

  async execute(args: GitCommitParams): Promise<CallToolResult> {
    const { message } = args;

    try {
      // Check if we're in a git repository
      try {
        await this.fs.stat(`${this.cwd}/.git`);
      } catch {
        return {
          content: [{
            type: "text",
            text: `❌ Not a git repository. Initialize git first with 'git init'.`,
          }],
          isError: true,
        };
      }

      // Validate commit message
      if (!message.trim()) {
        return {
          content: [{
            type: "text",
            text: `❌ Commit message cannot be empty.`,
          }],
          isError: true,
        };
      }

      // Get git status to see what files have changed
      const statusMatrix = await git.statusMatrix({
        fs: this.fs,
        dir: this.cwd,
      });

      // Filter for files that have changes (not committed)
      const changedFiles = statusMatrix.filter(([_filepath, headStatus, workdirStatus, stageStatus]) => {
        // File has changes if:
        // - workdir differs from head (modified/new/deleted)
        // - stage differs from workdir (unstaged changes)
        return headStatus !== workdirStatus || workdirStatus !== stageStatus;
      });

      if (changedFiles.length === 0) {
        return {
          content: [{
            type: "text",
            text: `ℹ️ No changes to commit. Working tree is clean.`,
          }],
          isError: false,
        };
      }

      // Add all changed files to staging
      for (const [filepath] of changedFiles) {
        try {
          await git.add({
            fs: this.fs,
            dir: this.cwd,
            filepath,
          });
        } catch {
          // If file was deleted, use git.remove instead
          try {
            await git.remove({
              fs: this.fs,
              dir: this.cwd,
              filepath,
            });
          } catch {
            // If both add and remove fail, skip this file
            console.warn(`Failed to stage file: ${filepath}`);
          }
        }
      }

      // Get current branch name
      let currentBranch = 'main';
      try {
        currentBranch = await git.currentBranch({
          fs: this.fs,
          dir: this.cwd,
        }) || 'main';
      } catch {
        // Default to 'main' if we can't get the current branch
      }

      // Get author info (use default if not configured)
      const author = {
        name: 'shakespeare.diy',
        email: 'assistant@shakespeare.diy',
      };

      // Try to get configured author from git config
      try {
        const configName = await git.getConfig({
          fs: this.fs,
          dir: this.cwd,
          path: 'user.name',
        });
        const configEmail = await git.getConfig({
          fs: this.fs,
          dir: this.cwd,
          path: 'user.email',
        });
        if (configName) author.name = configName;
        if (configEmail) author.email = configEmail;
      } catch {
        // Use defaults if config is not set
      }

      // Commit the changes
      const commitSha = await git.commit({
        fs: this.fs,
        dir: this.cwd,
        message: message.trim(),
        author,
        committer: author,
      });

      // Get short hash (first 7 characters)
      const shortHash = commitSha.substring(0, 7);

      // Analyze the changes for summary
      const addedFiles = changedFiles.filter(([, headStatus, workdirStatus]) =>
        headStatus === 0 && workdirStatus === 1
      ).length;

      const modifiedFiles = changedFiles.filter(([, headStatus, workdirStatus]) =>
        headStatus === 1 && workdirStatus === 1
      ).length;

      const deletedFiles = changedFiles.filter(([, headStatus, workdirStatus]) =>
        headStatus === 1 && workdirStatus === 0
      ).length;

      const totalFiles = changedFiles.length;

      const summary = `✅ Successfully committed ${totalFiles} file${totalFiles !== 1 ? 's' : ''} (${shortHash})`;

      let details = `📝 Commit: "${message.trim()}"\n`;
      details += `🔗 Hash: ${shortHash}\n`;
      details += `🌿 Branch: ${currentBranch}\n`;
      details += `📊 Changes:\n`;
      if (addedFiles > 0) details += `  • ${addedFiles} file${addedFiles !== 1 ? 's' : ''} added\n`;
      if (modifiedFiles > 0) details += `  • ${modifiedFiles} file${modifiedFiles !== 1 ? 's' : ''} modified\n`;
      if (deletedFiles > 0) details += `  • ${deletedFiles} file${deletedFiles !== 1 ? 's' : ''} deleted\n`;

      return {
        content: [{
          type: "text",
          text: `${summary}\n\n${details}`,
        }],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error committing changes: ${String(error)}`,
        }],
        isError: true,
      };
    }
  }
}