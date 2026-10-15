import { z } from "zod";
import type { Tool, ToolResult } from "./Tool";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand } from "../commands/ShellCommand";
import { Git } from "../git";
import type { NostrSigner } from "@nostrify/nostrify";
import { ShellExecutor } from "../shell/executor";
import {
  CatCommand,
  CdCommand,
  ClearCommand,
  CpCommand,
  CurlCommand,
  CutCommand,
  DateCommand,
  DiffCommand,
  EchoCommand,
  EnvCommand,
  FindCommand,
  GitCommand,
  GrepCommand,
  HeadCommand,
  HexdumpCommand,
  LsCommand,
  MkdirCommand,
  MvCommand,
  NpxCommand,
  PipCommand,
  PythonCommand,
  PwdCommand,
  RmCommand,
  SedCommand,
  ShakespeareCommand,
  SortCommand,
  TailCommand,
  TouchCommand,
  TrCommand,
  TscCommand,
  UniqCommand,
  UnzipCommand,
  WcCommand,
  WhoamiCommand,
  WhichCommand,
} from "../commands";

interface ShellToolParams {
  command: string;
}

/**
 * Shell tool exposing a bash-like command interface over the virtual
 * filesystem.
 *
 * Internally backed by ShellExecutor, which tokenizes, parses, expands,
 * and runs the command against a registry of ShellCommand
 * implementations. Supports the practical subset of bash features:
 *
 *   - Pipes, &&, ||, ;, newlines
 *   - Quoting (single/double) and escaping
 *   - Variable expansion ($VAR, ${VAR}), command substitution ($(...), ``),
 *     arithmetic expansion ($((...))), tilde (~), brace expansion ({a,b,c}),
 *     glob expansion (*, ?, [...])
 *   - Redirections: >, >>, <, <<, 2>, 2>>, &>, 2>&1, 1>&2
 *   - Control flow: if/then/elif/else/fi, for, while, until, case
 *   - Subshells (…) and brace groups { … }
 *   - Built-ins: true, false, :, export, unset, exit, test / [
 */
export class ShellTool implements Tool<ShellToolParams> {
  private readonly fs: JSRuntimeFS;
  private readonly git: Git;
  private readonly commands: Map<string, ShellCommand>;
  private readonly signer?: NostrSigner;
  private readonly corsProxy: string;
  private readonly executor: ShellExecutor;

  readonly description =
    "Execute shell commands over the virtual filesystem. Supports pipes (|), conditionals (&&, ||, ;), quoting, variable expansion ($VAR), command substitution ($(cmd), `cmd`), arithmetic ($((…))), tilde (~), brace {a,b} and glob (*, ?, […]) expansion, redirections (>, >>, <, <<, 2>, 2>&1), control flow (if, for, while, until, case), and subshells. Built-in commands: cat, ls, cd, pwd, cp, mv, rm, echo, head, tail, grep, find, wc, touch, mkdir, sort, uniq, cut, tr, sed, diff, which, whoami, date, env, clear, git, curl, unzip, hexdump, tsc, npx, python3, pip. Typecheck the project with `tsc --noEmit` (the real TypeScript compiler, using the project's tsconfig and dependencies). `python3` is real CPython (Pyodide): scripts can read and write the project and /tmp, Pyodide's packages (numpy, pandas, ...) load automatically on import, and `pip install` adds pure-Python packages for the session. It cannot open sockets or start subprocesses.";

  readonly inputSchema = z.object({
    command: z
      .string()
      .describe(
        'Shell command to execute. Supports pipes (cat x | grep y), conditionals (cmd1 && cmd2 || cmd3), quoting ("a b" or \'a b\'), variable expansion ($VAR or ${VAR}), command substitution ($(cmd) or `cmd`), arithmetic ($((1+2))), glob patterns (*.ts), brace expansion ({a,b,c}), redirections (> file, >> file, < file, 2>&1), and control flow (if/for/while/case/until). Example: "for f in src/*.tsx; do echo $f; done"',
      ),
  });

  constructor(fs: JSRuntimeFS, cwd: string, git: Git, corsProxy: string, signer?: NostrSigner) {
    this.fs = fs;
    this.git = git;
    this.corsProxy = corsProxy;
    this.signer = signer;
    this.commands = new Map();

    // Register all built-in commands.
    this.registerCommand(new CatCommand(fs));
    const cdCommand = new CdCommand(fs);
    this.registerCommand(cdCommand);
    this.registerCommand(new ClearCommand());
    this.registerCommand(new CpCommand(fs));
    this.registerCommand(new CurlCommand(fs, this.corsProxy));
    this.registerCommand(new CutCommand(fs));
    this.registerCommand(new DateCommand());
    this.registerCommand(new DiffCommand(fs));
    this.registerCommand(new EchoCommand());
    const envCommand = new EnvCommand();
    this.registerCommand(envCommand);
    this.registerCommand(new FindCommand(fs));
    this.registerCommand(new GitCommand({ git: this.git, fs, cwd, signer: this.signer }));
    this.registerCommand(new GrepCommand(fs));
    this.registerCommand(new HeadCommand(fs));
    this.registerCommand(new HexdumpCommand(fs));
    this.registerCommand(new LsCommand(fs));
    this.registerCommand(new MkdirCommand(fs));
    this.registerCommand(new MvCommand(fs));
    const pythonCommand = new PythonCommand(fs, cwd);
    this.registerCommand(pythonCommand);
    this.registerCommand(new PythonCommand(fs, cwd, 'python'));
    this.registerCommand(new PipCommand(pythonCommand));
    this.registerCommand(new PipCommand(pythonCommand, 'pip3'));
    this.registerCommand(new PwdCommand());
    this.registerCommand(new RmCommand(fs));
    this.registerCommand(new SedCommand(fs));
    this.registerCommand(new ShakespeareCommand());
    this.registerCommand(new SortCommand(fs));
    this.registerCommand(new TailCommand(fs));
    this.registerCommand(new TouchCommand(fs));
    this.registerCommand(new TrCommand(fs));
    this.registerCommand(new TscCommand(fs, cwd));
    this.registerCommand(new UniqCommand(fs));
    this.registerCommand(new UnzipCommand(fs));
    this.registerCommand(new WcCommand(fs));
    this.registerCommand(new WhoamiCommand());
    // which and npx must see the final registry.
    this.registerCommand(new WhichCommand(this.commands));
    this.registerCommand(new NpxCommand(this.commands));

    this.executor = new ShellExecutor({
      fs,
      commands: this.commands,
      initialCwd: cwd,
      initialEnv: { PWD: cwd, SHELL: '/bin/sh', HOME: cwd },
      home: cwd,
    });
    cdCommand.setHomeDir(cwd);
    envCommand.envSource = () => this.executor.getVars();
  }

  private registerCommand(command: ShellCommand): void {
    this.commands.set(command.name, command);
  }

  async execute(args: ShellToolParams): Promise<ToolResult> {
    const { command } = args;
    if (!command.trim()) {
      return { content: "Error: Empty command" };
    }

    const result = await this.executor.run(command);
    // Keep PWD in sync after cd.
    this.executor.setVar('PWD', this.executor.getCwd());

    // Format output in the shape existing tests/UI expect.
    return { content: formatResult(result.stdout, result.stderr, result.exitCode) };
  }

  /** Current working directory (updated by cd). */
  getCurrentWorkingDirectory(): string {
    return this.executor.getCwd();
  }

  /** Replace the working directory. */
  setCurrentWorkingDirectory(newCwd: string): void {
    this.executor.setCwd(newCwd);
    this.executor.setVar('PWD', newCwd);
  }

  /** List of user-facing commands (excludes easter eggs). */
  getAvailableCommands(): Array<{ name: string; description: string; usage: string }> {
    return Array.from(this.commands.values())
      .filter((cmd) => !cmd.isEasterEgg)
      .map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
      }));
  }
}

function formatResult(stdout: string, stderr: string, exitCode: number): string {
  let output = '';
  if (stdout) output += stdout;
  if (stderr) {
    if (output) output += '\n';
    output += stderr;
  }
  if (exitCode !== 0) {
    if (output) output += '\n';
    output += `Exit code: ${exitCode}`;
  }
  return output || '(no output)';
}
