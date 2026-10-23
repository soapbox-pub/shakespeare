import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult, toLatin1 } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import type { TagObject } from "isomorphic-git";
import { parseArgs, unknownOption } from "./args";
import { commitDisplay, COMMIT_DISPLAY_SPEC, renderCommit, type CommitDisplay } from "./log";
import { isBinary } from "./diffing";
import { formatDateStyle } from "./pretty";
import { resolveRevision, RevisionError } from "./revisions";

export class GitShowCommand implements GitSubcommand {
  name = 'show';
  description = 'Show various types of objects';
  usage = 'git show [<options>] [<object>...] [-- <path>...]';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    try {
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git');
      }

      const parsed = parseArgs(args, {
        flags: { ...COMMIT_DISPLAY_SPEC.flags, q: 'quiet', quiet: 'quiet', 'no-decorate': 'noDecorate' },
        values: COMMIT_DISPLAY_SPEC.values,
        optional: COMMIT_DISPLAY_SPEC.optional,
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage));
      }

      const display = await commitDisplay(this.git, cwd, parsed, true);
      const objects = parsed.positionals.length > 0 ? parsed.positionals : ['HEAD'];
      const pathspecs = parsed.paths;

      const chunks: Array<string | Uint8Array> = [];
      for (const spec of objects) {
        let oid: string;
        try {
          oid = await resolveRevision(this.git, cwd, spec);
        } catch (error) {
          if (error instanceof RevisionError) {
            if (spec === 'HEAD') return createErrorResult("fatal: your current branch does not have any commits yet");
            return createErrorResult(error.message);
          }
          throw error;
        }
        chunks.push(...await this.showObject(cwd, spec, oid, display, pathspecs, chunks.length > 0));
      }

      // Blobs may be binary; keep them byte-for-byte.
      if (chunks.some((c) => c instanceof Uint8Array)) {
        const encoder = new TextEncoder();
        const packed = chunks.map((c) => toLatin1(typeof c === 'string' ? encoder.encode(c) : c)).join('');
        return { ...createSuccessResult(packed), stdoutKind: 'bytes' };
      }
      return createSuccessResult(chunks.join(''));
    } catch (error) {
      return createErrorResult(`git show: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async showObject(
    cwd: string,
    spec: string,
    oid: string,
    display: CommitDisplay,
    pathspecs: string[],
    notFirst: boolean,
  ): Promise<Array<string | Uint8Array>> {
    const obj = await this.git.readObject({ dir: cwd, oid, format: 'parsed' });
    const multiline = display.format !== 'oneline' && !display.format.includes(':');
    const gap = notFirst && multiline ? '\n' : '';

    switch (obj.type) {
      case 'blob': {
        const bytes = obj.object as Uint8Array;
        return [isBinary(bytes) ? bytes : new TextDecoder().decode(bytes)];
      }
      case 'tree': {
        const { tree } = await this.git.readTree({ dir: cwd, oid });
        return [`${notFirst ? '\n' : ''}tree ${spec}\n\n${tree.map((e) => `${e.path}${e.type === 'tree' ? '/' : ''}\n`).join('')}`];
      }
      case 'tag': {
        const tag = obj.object as TagObject;
        const header = [
          `tag ${tag.tag}`,
          `Tagger: ${tag.tagger.name} <${tag.tagger.email}>`,
          `Date:   ${formatDateStyle(tag.tagger, display.dateStyle)}`,
          '',
          tag.message.replace(/\n+$/, ''),
          '',
        ].join('\n');
        const target = await this.showObject(cwd, tag.object, tag.object, display, pathspecs, false);
        return [`${gap}${header}\n`, ...target];
      }
      case 'commit': {
        const entry = await this.git.readCommit({ dir: cwd, oid });
        return [gap + await renderCommit(this.git, cwd, entry, display, pathspecs)];
      }
      default:
        return [];
    }
  }
}
