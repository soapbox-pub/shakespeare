import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { isValidRefName } from "./refUtils";

export class GitInitCommand implements GitSubcommand {
  name = 'init';
  description = 'Create an empty Git repository or reinitialize an existing one';
  usage = 'git init [-q | --quiet] [--bare] [-b <branch-name> | --initial-branch=<branch-name>] [<directory>]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      const parsed = parseArgs(args, {
        flags: { q: 'quiet', quiet: 'quiet', bare: 'bare' },
        values: { b: 'branch', 'initial-branch': 'branch', template: 'template', 'object-format': 'objectFormat' },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.rest.length > 1) {
        return createErrorResult(`usage: ${this.usage}`, 129);
      }

      const quiet = parsed.has('quiet');
      const bare = parsed.has('bare');
      const branch = parsed.get('branch');
      if (branch !== undefined && !isValidRefName(branch)) {
        return createErrorResult(`fatal: invalid initial branch name: '${branch}'`, 128);
      }

      const directory = parsed.rest[0];
      const targetDir = normalizeDir(directory
        ? (directory.startsWith('/') ? directory : `${cwd}/${directory}`)
        : cwd);
      const gitDir = bare ? targetDir : `${targetDir}/.git`;

      await this.fs.mkdir(targetDir, { recursive: true });

      let exists = false;
      try {
        await this.fs.stat(bare ? `${targetDir}/HEAD` : `${targetDir}/.git`);
        exists = true;
      } catch {
        // Not a repository yet.
      }

      if (exists) {
        const warning = branch !== undefined ? `warning: re-init: ignored --initial-branch=${branch}\n` : '';
        return {
          exitCode: 0,
          stdout: quiet ? '' : `Reinitialized existing Git repository in ${gitDir}/\n`,
          stderr: warning,
        };
      }

      await this.git.init({
        dir: targetDir,
        bare,
        defaultBranch: branch || 'main',
      });

      if (!bare) {
        try {
          await this.git.setConfig({ dir: targetDir, path: 'user.name', value: 'shakespeare.diy' });
          await this.git.setConfig({ dir: targetDir, path: 'user.email', value: 'assistant@shakespeare.diy' });
        } catch {
          // Non-fatal
        }
      }

      return createSuccessResult(quiet ? '' : `Initialized empty Git repository in ${gitDir}/\n`);
    } catch (error) {
      return createErrorResult(`git init: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

function normalizeDir(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}
