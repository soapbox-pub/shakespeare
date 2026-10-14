import type { JSRuntimeFS } from "../JSRuntime";
import { tsc } from "../tsc";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createErrorResult } from "./ShellCommand";

/**
 * Implementation of the 'tsc' command: the real TypeScript compiler CLI,
 * running in a Web Worker against the project's own TypeScript version and
 * its dependencies' type declarations.
 */
export class TscCommand implements ShellCommand {
  name = 'tsc';
  description = 'TypeScript compiler (run `tsc --noEmit` to typecheck the project)';
  usage = 'tsc [--noEmit] [-p project] [--pretty] [options] [file...]';

  private fs: JSRuntimeFS;
  private projectRoot: string;

  constructor(fs: JSRuntimeFS, projectRoot: string) {
    this.fs = fs;
    this.projectRoot = projectRoot;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    const inProject = cwd === this.projectRoot || cwd.startsWith(`${this.projectRoot}/`);
    try {
      return await tsc(this.fs, { projectRoot: inProject ? this.projectRoot : cwd, cwd, args });
    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
