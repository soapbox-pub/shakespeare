import type { JSRuntimeFS } from "../JSRuntime";
import { python, PYTHON_VERSION } from "../python";
import type { PythonMode } from "../python/runPython";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createErrorResult, createSuccessResult } from "./ShellCommand";
import { resolvePath } from "./utils";

/** Interpreter options that are accepted and ignored. */
const IGNORED_FLAGS = new Set(['-u', '-B', '-E', '-s', '-S', '-I', '-O', '-OO', '-q', '-b', '-bb', '-d', '-v']);
const IGNORED_VALUE_OPTIONS = new Set(['-W', '-X']);

/**
 * Implementation of the 'python3' command (and its 'python' alias): CPython
 * compiled to WebAssembly (Pyodide), running in a Web Worker. Scripts see the
 * project and /tmp, and their file writes are saved back to the project.
 * HTTP requests to other sites go through the CORS proxy.
 */
export class PythonCommand implements ShellCommand {
  name: string;
  description = 'Python 3 interpreter (Pyodide). Scripts can read and write the project and /tmp and make HTTP requests (through the CORS proxy); imported packages Pyodide provides (numpy, pandas, ...) install automatically';
  usage: string;

  private fs: JSRuntimeFS;
  private projectRoot: string;
  private corsProxy?: string;

  constructor(fs: JSRuntimeFS, projectRoot: string, corsProxy?: string, name = 'python3') {
    this.fs = fs;
    this.projectRoot = projectRoot;
    this.corsProxy = corsProxy;
    this.name = name;
    this.usage = `${name} [-c cmd | -m module | file | -] [arg...]`;
  }

  async execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    let mode: PythonMode | undefined;
    let argv: string[] = [];
    let stdin = input;

    let i = 0;
    for (; i < args.length; i++) {
      const arg = args[i];
      if (arg === '-V' || arg === '--version') {
        return createSuccessResult(`Python ${PYTHON_VERSION}\n`);
      } else if (arg === '-h' || arg === '--help') {
        return createSuccessResult(`usage: ${this.usage}\n`);
      } else if (arg.startsWith('-c')) {
        const code = arg === '-c' ? args[++i] : arg.slice(2);
        if (code === undefined) return this.usageError('Argument expected for the -c option');
        mode = { kind: 'code', code, filename: '<string>' };
        argv = ['-c', ...args.slice(i + 1)];
        break;
      } else if (arg.startsWith('-m')) {
        const module = arg === '-m' ? args[++i] : arg.slice(2);
        if (module === undefined) return this.usageError('Argument expected for the -m option');
        const rest = args.slice(i + 1);
        mode = module === 'pip' ? { kind: 'pip', args: rest } : { kind: 'module', module };
        argv = ['-m', ...rest];
        break;
      } else if (IGNORED_VALUE_OPTIONS.has(arg)) {
        i++;
      } else if (IGNORED_FLAGS.has(arg) || IGNORED_VALUE_OPTIONS.has(arg.slice(0, 2))) {
        continue;
      } else if (arg === '-') {
        break;
      } else if (arg === '--') {
        i++;
        break;
      } else if (arg.startsWith('-')) {
        return this.usageError(`Unknown option: ${arg}`);
      } else {
        break;
      }
    }

    if (!mode) {
      const script = args[i];
      if (script !== undefined && script !== '-') {
        mode = { kind: 'file', path: script };
        argv = args.slice(i);
      } else if (input !== undefined) {
        mode = { kind: 'code', code: input, filename: '<stdin>' };
        argv = script === '-' ? args.slice(i) : [''];
        stdin = undefined;
      } else {
        return createErrorResult(`${this.name}: interactive mode is not supported; pass a script, -c, or code on stdin`, 2);
      }
    }

    const roots = [this.projectRoot, '/tmp'];
    if (mode.kind === 'file') {
      const path = resolvePath(mode.path, cwd);
      if (!roots.some((root) => path.startsWith(`${root}/`))) {
        return createErrorResult(`${this.name}: can't open file '${mode.path}': only the project and /tmp are available`, 2);
      }
    }

    try {
      return await python(this.fs, { roots, cwd, mode, argv, stdin, corsProxy: this.corsProxy });
    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private usageError(message: string): ShellCommandResult {
    return createErrorResult(`${message}\nusage: ${this.usage}`, 2);
  }
}

/** Implementation of 'pip' and 'pip3': `python3 -m pip`, which installs packages with micropip. */
export class PipCommand implements ShellCommand {
  name: string;
  description = 'Install Python packages for this session (pure-Python wheels and Pyodide packages, via micropip)';
  usage: string;

  private python: PythonCommand;

  constructor(python: PythonCommand, name = 'pip') {
    this.python = python;
    this.name = name;
    this.usage = `${name} install package...`;
  }

  execute(args: string[], cwd: string, input?: string): Promise<ShellCommandResult> {
    return this.python.execute(['-m', 'pip', ...args], cwd, input);
  }
}
