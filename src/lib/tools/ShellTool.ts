import { z } from "zod";
import { Bash, defineCommand, getCommandNames, type CommandName } from "just-bash/browser";
import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand } from "../commands/ShellCommand";
import { Git } from "../git";
import type { NostrSigner } from "@nostrify/nostrify";
import { BashFS } from "../shell/BashFS";
import {
  CurlCommand,
  GitCommand,
  HexdumpCommand,
  NpxCommand,
  PipCommand,
  PythonCommand,
  ShakespeareCommand,
  TscCommand,
  UnzipCommand,
} from "../commands";

interface ShellToolParams {
  command: string;
}

/**
 * just-bash built-ins that don't work in the browser (sqlite3 needs worker
 * threads, the gzip family needs zlib) or are replaced by our own commands.
 */
const EXCLUDED_BUILTINS = new Set(['sqlite3', 'gzip', 'gunzip', 'zcat', 'curl', 'python3', 'python']);

/**
 * Shell tool exposing bash over the virtual filesystem.
 *
 * Scripts are run by just-bash, a bash interpreter written in TypeScript: the
 * full bash language (functions, arrays, [[ ]], set -e, here-strings, process
 * substitution, ...) and the usual Unix utilities. Shakespeare's own commands
 * (git, tsc, python3, curl, ...) are registered alongside them. The working
 * directory carries over between calls; variables and functions don't.
 */
export class ShellTool implements Tool<ShellToolParams> {
  private readonly bash: Bash;
  private readonly custom: Map<string, ShellCommand>;
  private cwd: string;

  readonly description =
    "Run a bash script over the virtual filesystem. The full bash language is supported: pipes, &&/||, quoting, variables and parameter expansion (${x:-d}, ${x%.*}, ${x//a/b}), command substitution, arithmetic, globs and brace expansion, redirections (>, >>, <, <<, <<<, 2>&1, &>, /dev/null), here-docs, process substitution, if/for/while/until/case, functions, local, arrays, [[ ]], set -e/-u/-o pipefail, and subshells. Commands include cat, ls, cp, mv, rm, mkdir, touch, ln, find, grep, rg, sed, awk, jq, yq, sort, uniq, cut, tr, head, tail, wc, diff, xargs, tee, printf, basename, dirname, tree, base64, sha256sum, tar, plus git, curl, unzip, hexdump, tsc, npx, python3 and pip. Typecheck the project with `tsc --noEmit` (the real TypeScript compiler, using the project's tsconfig and dependencies). `python3` is real CPython (Pyodide): scripts can read and write the project and /tmp, Pyodide's packages (numpy, pandas, ...) load automatically on import, and `pip install` adds pure-Python packages for the session. HTTP requests work and go through the CORS proxy (urllib.request, requests, pyodide.http.pyfetch); raw sockets, websockets, and subprocesses don't. The working directory persists between calls; shell variables and functions do not.";

  readonly inputSchema = z.object({
    command: z
      .string()
      .describe(
        'Bash script to execute. Example: "for f in src/*.tsx; do grep -q useState \\"$f\\" && echo \\"$f\\"; done"',
      ),
  });

  constructor(fs: JSRuntimeFS, cwd: string, git: Git, corsProxy: string, signer?: NostrSigner) {
    this.cwd = cwd;

    const python = new PythonCommand(fs, cwd, corsProxy);
    const custom: ShellCommand[] = [
      new CurlCommand(fs, corsProxy),
      new GitCommand({ git, fs, cwd, signer }),
      new HexdumpCommand(fs),
      python,
      new PythonCommand(fs, cwd, corsProxy, 'python'),
      new PipCommand(python),
      new PipCommand(python, 'pip3'),
      new ShakespeareCommand(),
      new TscCommand(fs, cwd),
      new UnzipCommand(fs),
    ];
    this.custom = new Map(custom.map((cmd) => [cmd.name, cmd]));
    const npx = new NpxCommand(this.custom);
    this.custom.set(npx.name, npx);

    const builtins = getCommandNames().filter((name) => !EXCLUDED_BUILTINS.has(name));
    const commandNames = [...new Set([...builtins, ...this.custom.keys()])];

    this.bash = new Bash({
      fs: new BashFS(fs, cwd, () => commandNames),
      cwd,
      env: { HOME: cwd, SHELL: '/bin/bash', USER: 'user' },
      commands: builtins as CommandName[],
      customCommands: [...this.custom.values()].map(toBashCommand),
    });
  }

  async execute(args: ShellToolParams): Promise<ToolResult> {
    const { command } = args;
    if (!command.trim()) {
      return { content: "Error: Empty command" };
    }

    let result;
    try {
      result = await this.bash.exec(command, { cwd: this.cwd, rawScript: true });
    } catch (error) {
      // just-bash rejects when a redirection's write fails (e.g. outside the project).
      const message = error instanceof Error ? error.message : String(error);
      return { content: `bash: ${message}\nThe script stopped at this error.\nExit code: 1` };
    }
    if (result.env.PWD) this.cwd = result.env.PWD;

    let stderr = result.stderr;
    if (/: command not found$/m.test(stderr)) {
      stderr += `Available commands: ${this.getAvailableCommands().map((cmd) => cmd.name).join(', ')}\n`;
    }

    return { content: formatResult(result.stdout, stderr, result.exitCode) };
  }

  /** Current working directory (updated by cd). */
  getCurrentWorkingDirectory(): string {
    return this.cwd;
  }

  /** Replace the working directory. */
  setCurrentWorkingDirectory(newCwd: string): void {
    this.cwd = newCwd;
  }

  /** List of user-facing commands (excludes easter eggs). */
  getAvailableCommands(): Array<{ name: string; description: string; usage: string }> {
    const builtins = getCommandNames()
      .filter((name) => !EXCLUDED_BUILTINS.has(name) && !this.custom.has(name))
      .map((name) => ({ name, description: '', usage: '' }));
    const custom = [...this.custom.values()]
      .filter((cmd) => !cmd.isEasterEgg)
      .map((cmd) => ({ name: cmd.name, description: cmd.description, usage: cmd.usage }));
    return [...builtins, ...custom].sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** Expose a Shakespeare command to just-bash. */
function toBashCommand(cmd: ShellCommand) {
  return defineCommand(cmd.name, async (args, ctx) => {
    const input = decodeStdin(ctx.stdin);
    const result = await cmd.execute(args, ctx.cwd, input || undefined);
    const stderr = result.stderr && !result.stderr.endsWith('\n') ? `${result.stderr}\n` : result.stderr;
    return { stdout: result.stdout, stdoutKind: result.stdoutKind, stderr, exitCode: result.exitCode };
  });
}

/** just-bash passes stdin as a latin1 byte string; our commands take text. */
function decodeStdin(stdin: unknown): string {
  const bytes = String(stdin);
  if (!bytes) return '';
  return new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
}

function formatResult(stdout: string, stderr: string, exitCode: number): string {
  let output = '';
  if (stdout) output += stdout;
  if (stderr) {
    if (output && !output.endsWith('\n')) output += '\n';
    output += stderr;
  }
  if (exitCode !== 0) {
    if (output && !output.endsWith('\n')) output += '\n';
    output += `Exit code: ${exitCode}`;
  }
  return output || '(no output)';
}
