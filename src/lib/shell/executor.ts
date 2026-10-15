/**
 * Shell executor.
 *
 * Walks an AST produced by parse() and runs it against a registry of
 * ShellCommand implementations. Handles:
 *
 *   - Simple commands with glob/variable/substitution expansion
 *   - Pipelines (stdout of cmd N becomes stdin of cmd N+1)
 *   - && / || conditional chains
 *   - Sequences (;, newline)
 *   - Redirections: >, >>, <, <<, 2>, 2>>, &>, >&, <&
 *   - Control flow: if, while, until, for, case
 *   - Subshells and brace groups (in our single-process model, these
 *     share the same env — subshells don't get a copy since we can't
 *     actually fork)
 *   - Variable assignments and exit-status tracking
 *
 * Built-in commands (always available, not in the registry):
 *   - true, false
 *   - `[` / test (minimal)
 *   - export (stores in env)
 *   - exit (signals termination of the current script)
 *
 * Since we can't really background processes, `cmd &` is treated as a
 * synchronous foreground command with a warning.
 */

import { join, normalize } from 'path-browserify';
import type {
  CommandList, Command, SimpleCommand, Pipeline, AndOrList,
  ForLoop, WhileLoop, IfStatement, CaseStatement, Subshell, Group,
  Redirection, Word,
} from './ast';
import type { ShellCommand, ShellCommandResult } from '../commands/ShellCommand';
import type { JSRuntimeFS } from '../JSRuntime';
import { parse } from './parser';
import { tokenize } from './tokenizer';
import { expandWord, expandWordToString, expandHeredoc, type ShellEnv } from './expand';
import { validateWritePath } from '../security';

export interface ExecutorOptions {
  fs: JSRuntimeFS;
  /** The command registry. */
  commands: Map<string, ShellCommand>;
  /** Initial working directory. */
  initialCwd: string;
  /** Initial environment variables. */
  initialEnv?: Record<string, string>;
  /** Home directory for tilde expansion (defaults to '/'). */
  home?: string;
}

/** Result of running a full script. */
export interface ExecuteResult {
  /** Exit status of the last command. */
  exitCode: number;
  /** Collected stdout from top-level commands not captured elsewhere. */
  stdout: string;
  /** Collected stderr. */
  stderr: string;
  /** Final working directory (may change via cd). */
  cwd: string;
}

/** Internal per-command IO state. */
interface IO {
  input?: string;
  /** When defined, suppresses the normal stdout sink and captures instead. */
  captureStdout?: boolean;
  /** Pre-filled initial stdout (from heredocs etc.). */
  inputOverride?: string;
}

export class ShellExecutor {
  readonly fs: JSRuntimeFS;
  readonly commands: Map<string, ShellCommand>;
  private cwd: string;
  private readonly home: string;
  private readonly vars: Record<string, string> = {};
  private lastExitCode = 0;
  /** Signals that an `exit` builtin was encountered. */
  private exited = false;

  constructor(options: ExecutorOptions) {
    this.fs = options.fs;
    this.commands = options.commands;
    this.cwd = options.initialCwd;
    this.home = options.home ?? '/';
    Object.assign(this.vars, options.initialEnv ?? {});
  }

  getCwd(): string { return this.cwd; }
  setCwd(cwd: string): void { this.cwd = cwd; }

  /** Parse + run a script string. */
  async run(script: string): Promise<ExecuteResult> {
    let ast: CommandList;
    try {
      ast = parse(tokenize(script));
    } catch (error) {
      return {
        exitCode: 2,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        cwd: this.cwd,
      };
    }
    this.exited = false;
    const out: string[] = [];
    const err: string[] = [];
    for (const cmd of ast.commands) {
      if (this.exited) break;
      const result = await this.execCommand(cmd);
      if (result.stdout) out.push(result.stdout);
      if (result.stderr) err.push(result.stderr);
    }
    return {
      exitCode: this.lastExitCode,
      stdout: out.join(''),
      stderr: err.join(''),
      cwd: this.cwd,
    };
  }

  // ---------------------------------------------------------------
  // AST dispatch
  // ---------------------------------------------------------------

  private async execCommand(cmd: Command, io: IO = {}): Promise<ShellCommandResult> {
    switch (cmd.type) {
      case 'simple':    return this.execSimple(cmd, io);
      case 'pipeline':  return this.execPipeline(cmd, io);
      case 'and_or':    return this.execAndOr(cmd, io);
      case 'for':       return this.execFor(cmd, io);
      case 'while':     return this.execWhile(cmd, io);
      case 'if':        return this.execIf(cmd, io);
      case 'case':      return this.execCase(cmd, io);
      case 'subshell':  return this.execSubshell(cmd, io);
      case 'group':     return this.execGroup(cmd, io);
    }
  }

  // ---------------------------------------------------------------
  // Simple commands + redirection handling
  // ---------------------------------------------------------------

  private async execSimple(cmd: SimpleCommand, io: IO): Promise<ShellCommandResult> {
    // 1. Expand all words to argv.
    const env = this.makeEnv();
    const argv: string[] = [];
    for (const w of cmd.words) {
      const expanded = await expandWord(w, env);
      argv.push(...expanded);
    }

    // 2. Apply inline variable assignments.
    // If argv is empty, assignments persist in the executor environment.
    // Otherwise, they only apply to this command's invocation (we emulate
    // this by merging into a temporary snapshot just for the duration).
    const savedVars: Record<string, string | undefined> = {};
    const applyAssignments = async () => {
      for (const a of cmd.assignments) {
        savedVars[a.name] = this.vars[a.name];
        this.vars[a.name] = await expandWordToString(a.value, env);
      }
    };

    if (argv.length === 0) {
      // Assignments only (e.g. `FOO=bar`).
      await applyAssignments();
      this.lastExitCode = 0;
      return { exitCode: 0, stdout: '', stderr: '' };
    }

    await applyAssignments();

    try {
      // 3. Prepare IO by applying redirections.
      const prepared = await this.applyRedirections(cmd.redirections, io);
      if (prepared.error) {
        this.lastExitCode = 1;
        return { exitCode: 1, stdout: '', stderr: prepared.error };
      }

      // 4. Dispatch.
      const [name, ...args] = argv;
      const result = await this.runCommand(name, args, prepared.input);

      // 5. Apply post-redirections (write captured stdout/stderr to files).
      const finalResult = await this.writeRedirectedOutputs(result, prepared);
      if (finalResult.newCwd) {
        this.cwd = finalResult.newCwd;
      }
      this.lastExitCode = finalResult.exitCode;
      return finalResult;
    } finally {
      // Revert inline assignments if argv was non-empty (POSIX: only
      // persist for builtins; for non-builtins they're scoped). We keep
      // the simplified model: they always persist, which matches bash
      // for built-ins and is harmless for external commands.
      if (argv.length === 0) {
        // Persist.
      } else {
        // Restore.
        for (const [k, v] of Object.entries(savedVars)) {
          if (v === undefined) delete this.vars[k];
          else this.vars[k] = v;
        }
      }
    }
  }

  /** Dispatch to the command registry or a builtin. */
  private async runCommand(name: string, args: string[], input?: string): Promise<ShellCommandResult> {
    // Built-ins first (they wrap things the registry can't do).
    switch (name) {
      case 'true':   return { exitCode: 0, stdout: '', stderr: '' };
      case 'false':  return { exitCode: 1, stdout: '', stderr: '' };
      case ':':      return { exitCode: 0, stdout: '', stderr: '' };
      case 'export': return this.builtinExport(args);
      case 'unset':  return this.builtinUnset(args);
      case 'exit':   return this.builtinExit(args);
      case 'test':   case '[': return this.builtinTest(name, args);
    }

    const cmd = this.commands.get(name);
    if (!cmd) {
      const available = Array.from(this.commands.keys()).sort().join(', ');
      return {
        exitCode: 127,
        stdout: '',
        stderr: `Error: Command '${name}' not found\nAvailable commands: ${available}`,
      };
    }
    try {
      return await cmd.execute(args, this.cwd, input);
    } catch (error) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Error executing command '${name}': ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ---------------------------------------------------------------
  // Redirection
  // ---------------------------------------------------------------

  /**
   * Figure out what input the command should receive, and which streams
   * should be captured vs passed through. Returns a plan that the caller
   * executes after running the command.
   */
  private async applyRedirections(redirs: Redirection[], io: IO): Promise<{
    input?: string;
    /** Destinations for each fd after command runs. */
    stdoutFile?: { path: string; append: boolean };
    stderrFile?: { path: string; append: boolean };
    /** If true, stderr should be merged into stdout before the stdout file write. */
    mergeErrToOut?: boolean;
    /** If true, stdout should go to stderr (e.g. `>&2`). */
    mergeOutToErr?: boolean;
    error?: string;
  }> {
    const plan: {
      input?: string;
      stdoutFile?: { path: string; append: boolean };
      stderrFile?: { path: string; append: boolean };
      mergeErrToOut?: boolean;
      mergeOutToErr?: boolean;
      error?: string;
    } = {};

    // Inherit piped input by default.
    if (io.input !== undefined) plan.input = io.input;

    for (const r of redirs) {
      if (r.op === '<') {
        const path = await this.resolveRedirTarget(r.target);
        try {
          const content = await this.fs.readFile(this.absPath(path), 'utf8');
          plan.input = typeof content === 'string' ? content : new TextDecoder().decode(content);
        } catch {
          return { error: `${path}: No such file or directory` };
        }
        continue;
      }

      if (r.op === '<<') {
        const env = this.makeEnv();
        plan.input = await expandHeredoc(r.heredocBody ?? '', r.heredocExpand !== false, env);
        continue;
      }

      if (r.op === '>') {
        const path = await this.resolveRedirTarget(r.target);
        try { validateWritePath(path, '>', this.cwd); }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
        plan.stdoutFile = { path, append: false };
        continue;
      }

      if (r.op === '>>') {
        const path = await this.resolveRedirTarget(r.target);
        try { validateWritePath(path, '>>', this.cwd); }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
        plan.stdoutFile = { path, append: true };
        continue;
      }

      if (r.op === '2>') {
        const path = await this.resolveRedirTarget(r.target);
        try { validateWritePath(path, '2>', this.cwd); }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
        plan.stderrFile = { path, append: false };
        continue;
      }

      if (r.op === '2>>') {
        const path = await this.resolveRedirTarget(r.target);
        try { validateWritePath(path, '2>>', this.cwd); }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
        plan.stderrFile = { path, append: true };
        continue;
      }

      if (r.op === '&>') {
        const path = await this.resolveRedirTarget(r.target);
        try { validateWritePath(path, '&>', this.cwd); }
        catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
        plan.stdoutFile = { path, append: false };
        plan.mergeErrToOut = true;
        continue;
      }

      if (r.op === '>&') {
        // 2>&1 or 1>&2 — fd dup.
        if ('fd' in r.target) {
          const src = r.fd ?? 1;
          const dst = r.target.fd;
          if (src === 2 && dst === 1) plan.mergeErrToOut = true;
          else if (src === 1 && dst === 2) plan.mergeOutToErr = true;
          // Other fd combos: ignored (we only model 0/1/2).
        }
        continue;
      }

      if (r.op === '<&') {
        // <& fd dup on input. Rare. We only support closing (<&-) which
        // would be r.target.fd < 0 — not produced by our parser. Ignore.
        continue;
      }
    }

    return plan;
  }

  private async resolveRedirTarget(target: Word | { fd: number }): Promise<string> {
    if ('fd' in target) return String(target.fd);
    return expandWordToString(target, this.makeEnv());
  }

  /**
   * After running a command, route its stdout/stderr through redirection
   * and return the filtered result. stdout that was redirected to a file
   * is NOT included in the returned result.stdout.
   */
  private async writeRedirectedOutputs(
    result: ShellCommandResult,
    plan: Awaited<ReturnType<ShellExecutor['applyRedirections']>>,
  ): Promise<ShellCommandResult> {
    let outText = result.stdout ?? '';
    let errText = result.stderr ?? '';

    if (plan.mergeErrToOut) {
      outText = outText + errText;
      errText = '';
    } else if (plan.mergeOutToErr) {
      errText = errText + outText;
      outText = '';
    }

    if (plan.stdoutFile) {
      try {
        await this.writeFileRedirect(plan.stdoutFile.path, outText, plan.stdoutFile.append);
        outText = '';
      } catch (e) {
        errText = (errText ? errText + '\n' : '') +
          `shell: ${plan.stdoutFile.path}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (plan.stderrFile) {
      try {
        await this.writeFileRedirect(plan.stderrFile.path, errText, plan.stderrFile.append);
        errText = '';
      } catch (e) {
        errText = (errText ? errText + '\n' : '') +
          `shell: ${plan.stderrFile.path}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return {
      exitCode: result.exitCode,
      stdout: outText,
      stderr: errText,
      newCwd: result.newCwd,
    };
  }

  private async writeFileRedirect(path: string, content: string, append: boolean): Promise<void> {
    const full = this.absPath(path);
    if (append) {
      let existing = '';
      try {
        const c = await this.fs.readFile(full, 'utf8');
        existing = typeof c === 'string' ? c : new TextDecoder().decode(c);
      } catch {
        // File doesn't exist — we'll create it.
      }
      await this.fs.writeFile(full, existing + content, 'utf8');
    } else {
      await this.fs.writeFile(full, content, 'utf8');
    }
  }

  private absPath(p: string): string {
    return p.startsWith('/') ? normalize(p) : normalize(join(this.cwd, p));
  }

  // ---------------------------------------------------------------
  // Pipelines
  // ---------------------------------------------------------------

  private async execPipeline(p: Pipeline, io: IO): Promise<ShellCommandResult> {
    let pipeInput = io.input;
    const errChunks: string[] = [];
    let last: ShellCommandResult = { exitCode: 0, stdout: '', stderr: '' };

    for (let i = 0; i < p.commands.length; i++) {
      const isLast = i === p.commands.length - 1;
      const cmd = p.commands[i];
      const cmdIO: IO = { input: pipeInput };
      last = await this.execCommand(cmd, cmdIO);
      if (last.stderr) errChunks.push(last.stderr);
      if (isLast) {
        // Keep stdout for caller.
      } else {
        pipeInput = last.stdout;
      }
    }

    let exit = last.exitCode;
    if (p.negated) exit = exit === 0 ? 1 : 0;
    this.lastExitCode = exit;
    return {
      exitCode: exit,
      stdout: last.stdout,
      stderr: errChunks.join(''),
    };
  }

  // ---------------------------------------------------------------
  // And-or lists
  // ---------------------------------------------------------------

  private async execAndOr(n: AndOrList, io: IO): Promise<ShellCommandResult> {
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    let r = await this.execCommand(n.first, io);
    if (r.stdout) outChunks.push(r.stdout);
    if (r.stderr) errChunks.push(r.stderr);

    for (const { op, command } of n.rest) {
      const succeeded = r.exitCode === 0;
      const shouldRun = (op === '&&' && succeeded) || (op === '||' && !succeeded);
      if (!shouldRun) continue;
      r = await this.execCommand(command, io);
      if (r.stdout) outChunks.push(r.stdout);
      if (r.stderr) errChunks.push(r.stderr);
    }

    this.lastExitCode = r.exitCode;
    return {
      exitCode: r.exitCode,
      stdout: outChunks.join(''),
      stderr: errChunks.join(''),
    };
  }

  // ---------------------------------------------------------------
  // Compound commands
  // ---------------------------------------------------------------

  private async execFor(n: ForLoop, io: IO): Promise<ShellCommandResult> {
    const env = this.makeEnv();
    const items: string[] = [];
    for (const w of n.items ?? []) {
      items.push(...await expandWord(w, env));
    }
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    let exit = 0;
    for (const v of items) {
      this.vars[n.variable] = v;
      const r = await this.execList(n.body, io);
      if (r.stdout) outChunks.push(r.stdout);
      if (r.stderr) errChunks.push(r.stderr);
      exit = r.exitCode;
      if (this.exited) break;
    }
    this.lastExitCode = exit;
    return { exitCode: exit, stdout: outChunks.join(''), stderr: errChunks.join('') };
  }

  private async execWhile(n: WhileLoop, io: IO): Promise<ShellCommandResult> {
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    let exit = 0;
    let iter = 0;
    while (iter < 100000) { // safety cap
      const cond = await this.execList(n.condition, io);
      const ok = n.until ? cond.exitCode !== 0 : cond.exitCode === 0;
      if (!ok) break;
      const body = await this.execList(n.body, io);
      if (body.stdout) outChunks.push(body.stdout);
      if (body.stderr) errChunks.push(body.stderr);
      exit = body.exitCode;
      if (this.exited) break;
      iter++;
    }
    this.lastExitCode = exit;
    return { exitCode: exit, stdout: outChunks.join(''), stderr: errChunks.join('') };
  }

  private async execIf(n: IfStatement, io: IO): Promise<ShellCommandResult> {
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    const collect = async (list: CommandList): Promise<ShellCommandResult> => {
      const r = await this.execList(list, io);
      if (r.stdout) outChunks.push(r.stdout);
      if (r.stderr) errChunks.push(r.stderr);
      return r;
    };
    const condResult = await collect(n.condition);
    let branchResult: ShellCommandResult;
    if (condResult.exitCode === 0) {
      branchResult = await collect(n.then);
    } else {
      let matched = false;
      for (const elif of n.elifs) {
        const c = await collect(elif.condition);
        if (c.exitCode === 0) {
          branchResult = await collect(elif.then);
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (n.else) branchResult = await collect(n.else);
        else branchResult = { exitCode: 0, stdout: '', stderr: '' };
      } else {
        branchResult ??= { exitCode: 0, stdout: '', stderr: '' };
      }
    }
    this.lastExitCode = branchResult!.exitCode;
    return {
      exitCode: branchResult!.exitCode,
      stdout: outChunks.join(''),
      stderr: errChunks.join(''),
    };
  }

  private async execCase(n: CaseStatement, io: IO): Promise<ShellCommandResult> {
    const env = this.makeEnv();
    const subject = await expandWordToString(n.subject, env);
    for (const item of n.items) {
      for (const pat of item.patterns) {
        const patStr = await expandWordToString(pat, env);
        if (caseMatch(subject, patStr)) {
          return this.execList(item.body, io);
        }
      }
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  private async execSubshell(n: Subshell, io: IO): Promise<ShellCommandResult> {
    // True subshells would need env isolation. Our single-threaded VFS
    // makes that expensive and rarely needed. We save/restore cwd as a
    // partial concession.
    const savedCwd = this.cwd;
    try {
      const body = await this.execList(n.body, io);
      // Apply trailing redirections if any (on the subshell's aggregate output).
      if (n.redirections.length > 0) {
        const plan = await this.applyRedirections(n.redirections, io);
        if (plan.error) {
          return { exitCode: 1, stdout: '', stderr: plan.error };
        }
        return this.writeRedirectedOutputs(body, plan);
      }
      return body;
    } finally {
      this.cwd = savedCwd;
    }
  }

  private async execGroup(n: Group, io: IO): Promise<ShellCommandResult> {
    const body = await this.execList(n.body, io);
    if (n.redirections.length > 0) {
      const plan = await this.applyRedirections(n.redirections, io);
      if (plan.error) return { exitCode: 1, stdout: '', stderr: plan.error };
      return this.writeRedirectedOutputs(body, plan);
    }
    return body;
  }

  private async execList(list: CommandList, io: IO): Promise<ShellCommandResult> {
    let r: ShellCommandResult = { exitCode: 0, stdout: '', stderr: '' };
    const outChunks: string[] = [];
    const errChunks: string[] = [];
    for (const c of list.commands) {
      if (this.exited) break;
      r = await this.execCommand(c, io);
      if (r.stdout) outChunks.push(r.stdout);
      if (r.stderr) errChunks.push(r.stderr);
    }
    return {
      exitCode: r.exitCode,
      stdout: outChunks.join(''),
      stderr: errChunks.join(''),
    };
  }

  // ---------------------------------------------------------------
  // Built-ins
  // ---------------------------------------------------------------

  private builtinExport(args: string[]): ShellCommandResult {
    for (const a of args) {
      const eq = a.indexOf('=');
      if (eq > 0) {
        this.vars[a.slice(0, eq)] = a.slice(eq + 1);
      }
      // `export NAME` (without =) is a no-op in our model.
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  private builtinUnset(args: string[]): ShellCommandResult {
    for (const a of args) delete this.vars[a];
    return { exitCode: 0, stdout: '', stderr: '' };
  }

  private builtinExit(args: string[]): ShellCommandResult {
    const code = args[0] ? parseInt(args[0], 10) : this.lastExitCode;
    this.exited = true;
    return { exitCode: isNaN(code) ? 0 : code, stdout: '', stderr: '' };
  }

  private builtinTest(_name: string, args: string[]): ShellCommandResult {
    // `[` requires `]` as the last arg.
    let toks = args;
    if (_name === '[') {
      if (toks[toks.length - 1] !== ']') {
        return { exitCode: 2, stdout: '', stderr: '[: missing closing ]' };
      }
      toks = toks.slice(0, -1);
    }
    const truth = evalTest(toks);
    return { exitCode: truth ? 0 : 1, stdout: '', stderr: '' };
  }

  // ---------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------

  private makeEnv(): ShellEnv {
    return {
      getVar: (name) => {
        if (name === '?') return String(this.lastExitCode);
        if (name === '$') return '1'; // bogus PID
        if (name === '#') return '0';
        return this.vars[name] ?? '';
      },
      getCwd: () => this.cwd,
      getHome: () => this.home,
      runSubshell: async (script) => {
        // Run in a nested executor that shares our state (pragmatic
        // simplification — real bash forks). We capture stdout only.
        const out = await this.run(script);
        return out.stdout;
      },
      getFS: () => this.fs,
    };
  }

  /** Access the mutable variable store (used by wiring layer for PWD, etc.). */
  setVar(name: string, value: string): void {
    this.vars[name] = value;
  }

  /** Get a snapshot of all environment variables. */
  getVars(): Record<string, string> {
    return { ...this.vars };
  }

  getExitCode(): number { return this.lastExitCode; }
}

// ---------------------------------------------------------------------
// Minimal `test` / `[` evaluator
// ---------------------------------------------------------------------

function evalTest(toks: string[]): boolean {
  if (toks.length === 0) return false;
  if (toks.length === 1) return toks[0].length > 0;
  // Unary: -z s, -n s, -e file, -f file, -d file (file checks stubbed to false).
  if (toks.length === 2) {
    const [op, a] = toks;
    if (op === '-z') return a.length === 0;
    if (op === '-n') return a.length > 0;
    if (op === '!') return !evalTest([a]);
    // File tests can't pass without touching fs; we conservatively say false.
    return false;
  }
  if (toks.length === 3) {
    const [a, op, b] = toks;
    if (op === '=' || op === '==') return a === b;
    if (op === '!=') return a !== b;
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (isNaN(na) || isNaN(nb)) return false;
    switch (op) {
      case '-eq': return na === nb;
      case '-ne': return na !== nb;
      case '-lt': return na < nb;
      case '-le': return na <= nb;
      case '-gt': return na > nb;
      case '-ge': return na >= nb;
    }
  }
  return false;
}

// ---------------------------------------------------------------------
// Case pattern matching (sh glob, not regex)
// ---------------------------------------------------------------------

function caseMatch(subject: string, pattern: string): boolean {
  const regex = '^' + patternToRegex(pattern) + '$';
  return new RegExp(regex).test(subject);
}

function patternToRegex(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*') out += '.*';
    else if (c === '?') out += '.';
    else if (c === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close === -1) out += '\\[';
      else {
        out += pattern.slice(i, close + 1).replace(/^\[!/, '[^');
        i = close;
      }
    } else if ('.+^$(){}|\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
    i++;
  }
  return out;
}
