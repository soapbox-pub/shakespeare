import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult, toLatin1 } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { isBinary } from "./diffing";
import { objectType, peel, resolveRevision, RevisionError, type ObjectType } from "./revisions";

export class GitCatFileCommand implements GitSubcommand {
  name = 'cat-file';
  description = 'Provide contents or details of repository objects';
  usage = 'git cat-file (-t | -s | -e | -p | <type>) <object>';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      await this.fs.stat(`${cwd}/.git`);
    } catch {
      return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
    }

    const parsed = parseArgs(args, { flags: { t: 'type', s: 'size', e: 'exists', p: 'pretty' } });
    if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage));

    const modes = ['type', 'size', 'exists', 'pretty'].filter((m) => parsed.has(m));
    const [first, second] = parsed.positionals;
    const expectedType = modes.length === 0 ? first : undefined;
    const spec = modes.length === 0 ? second : first;
    if (modes.length > 1 || !spec || (modes.length === 0 && !['blob', 'tree', 'commit', 'tag'].includes(first ?? ''))) {
      return createErrorResult(`usage: ${this.usage}`);
    }

    let oid: string;
    try {
      oid = await resolveRevision(this.git, cwd, spec);
    } catch (error) {
      if (parsed.has('exists')) return { exitCode: 1, stdout: '', stderr: '' };
      if (error instanceof RevisionError) return createErrorResult(`fatal: Not a valid object name ${spec}`);
      throw error;
    }

    try {
      if (parsed.has('exists')) return createSuccessResult('');

      if (expectedType) {
        oid = await peel(this.git, cwd, oid, expectedType as ObjectType, spec);
      }
      const type = await objectType(this.git, cwd, oid);
      if (parsed.has('type')) return createSuccessResult(`${type}\n`);

      const { object } = await this.git.readObject({ dir: cwd, oid, format: 'content' });
      const raw = object as Uint8Array;
      if (parsed.has('size')) return createSuccessResult(`${raw.length}\n`);

      if (parsed.has('pretty') && type === 'tree') {
        const { tree } = await this.git.readTree({ dir: cwd, oid });
        return createSuccessResult(tree.map((e) => `${e.mode.padStart(6, '0')} ${e.type} ${e.oid}\t${e.path}\n`).join(''));
      }

      if (isBinary(raw)) return { ...createSuccessResult(toLatin1(raw)), stdoutKind: 'bytes' };
      return createSuccessResult(new TextDecoder().decode(raw));
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(`fatal: git cat-file ${spec}: bad file`);
      return createErrorResult(`fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
