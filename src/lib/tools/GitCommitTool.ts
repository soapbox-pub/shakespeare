import { z } from "zod";
import { Git } from "../git";

import type { Tool } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";

interface GitCommitParams {
  message: string;
}

export class GitCommitTool implements Tool<GitCommitParams> {
  private fs: JSRuntimeFS;
  private git: Git;
  private cwd: string;

  readonly description = "Commit changes to git with a commit message. Automatically adds all unstaged files.";

  readonly inputSchema = z.object({
    message: z.string().describe('Commit message text'),
  });

  constructor(fs: JSRuntimeFS, cwd: string, git: Git) {
    this.fs = fs;
    this.git = git;
    this.cwd = cwd;
  }

  async execute(args: GitCommitParams): Promise<string> {
    const { message } = args;

    try {
      // Check if we're in a git repository
      try {
        await this.fs.stat(`${this.cwd}/.git`);
      } catch {
        throw new Error(`❌ Not a git repository. Initialize git first with 'git init'.`);
      }

      // Validate commit message
      if (!message.trim()) {
        throw new Error(`❌ Commit message cannot be empty.`);
      }

      // Get git status to see what files have changed
      const statusMatrix = await this.git.statusMatrix({
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
        return `ℹ️ No changes to commit. Working tree is clean.`;
      }

      // Add all changed files to staging
      for (const [filepath] of changedFiles) {
        try {
          await this.git.add({
            dir: this.cwd,
            filepath,
          });
        } catch {
          // If file was deleted, use git.remove instead
          try {
            await this.git.remove({
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
        currentBranch = await this.git.currentBranch({
          dir: this.cwd,
        }) || 'main';
      } catch {
        // Default to 'main' if we can't get the current branch
      }

      // Commit the changes (author/committer will be set automatically by Git class)
      const commitSha = await this.git.commit({
        dir: this.cwd,
        message: message.trim(),
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

      return `${summary}\n\n${details}`;
    } catch (error) {
      throw new Error(`❌ Error committing changes: ${String(error)}`);
    }
  }
}