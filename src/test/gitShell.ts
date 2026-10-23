import { vi } from 'vitest';
import type { NPool } from '@nostrify/nostrify';
import { Git } from '@/lib/git';
import { ShellTool } from '@/lib/tools/ShellTool';
import { HostFS } from './HostFS';

export interface GitShell {
  fs: HostFS;
  git: Git;
  /** Run a command and return the tool's output text. */
  run(command: string): Promise<string>;
  /** Run a command, failing the test if it exits non-zero; returns its output. */
  ok(command: string): Promise<string>;
  read(path: string): Promise<string>;
  dispose(): void;
}

/**
 * A shell over a real temporary directory with a real isomorphic-git, cwd'd
 * into an empty `/projects/repo`, for end-to-end tests of the git command.
 */
export async function createGitShell(cwd = '/projects/repo'): Promise<GitShell> {
  const fs = new HostFS();
  await fs.mkdirp(cwd);
  await fs.mkdirp('/tmp');
  const nostr = { relays: new Map(), req: vi.fn(), query: vi.fn(), event: vi.fn() } as unknown as NPool;
  const git = new Git({ fs, nostr });
  const shell = new ShellTool(fs, cwd, git, 'https://proxy.example/{href}');

  const run = async (command: string) => (await shell.execute({ command })).content;

  return {
    fs,
    git,
    run,
    async ok(command) {
      const out = await run(command);
      if (/Exit code: [1-9]/.test(out)) throw new Error(`\`${command}\` failed:\n${out}`);
      return out;
    },
    read: (path) => fs.readFile(path.startsWith('/') ? path : `${cwd}/${path}`, 'utf8'),
    dispose: () => fs.dispose(),
  };
}
