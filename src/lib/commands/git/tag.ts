import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { abbrev, peel, resolveCommit, resolveRevision, RevisionError } from "./revisions";
import { attachDefaultValues, compareVersions, expandRefFormat, isAncestor, isValidRefName, matchesGlob, signature } from "./refUtils";

interface TagInfo {
  name: string;
  /** What the ref points at (a tag object for annotated tags). */
  oid: string;
  /** The tagged object with tags peeled. */
  target: string;
  annotated: boolean;
  /** Tag message, or the commit message for lightweight tags. */
  message: string;
  date: number;
}

export class GitTagCommand implements GitSubcommand {
  name = 'tag';
  description = 'Create, list, delete or verify a tag object';
  usage = 'git tag [-a | -s] [-f] [-m <msg> | -F <file>] <tagname> [<commit> | <object>]\n   or: git tag -d <tagname>...\n   or: git tag [-n[<num>]] -l [--contains <commit>] [--points-at <object>] [--sort=<key>] [--format=<format>] [<pattern>...]';

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
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git', 128);
      }

      // `-n` takes an optional attached number (`-n`, `-n3`).
      let lines: number | undefined;
      const rest: string[] = [];
      for (const arg of args) {
        const n = arg.match(/^-n(\d*)$/);
        if (n) lines = n[1] ? parseInt(n[1], 10) : 1;
        else rest.push(arg);
      }

      const parsed = parseArgs(attachDefaultValues(rest, ['contains', 'no-contains', 'merged', 'no-merged']), {
        flags: {
          l: 'list', list: 'list', d: 'delete', delete: 'delete', a: 'annotate', annotate: 'annotate',
          s: 'sign', sign: 'sign', f: 'force', force: 'force', v: 'verify', verify: 'verify',
          i: 'ignoreCase', 'ignore-case': 'ignoreCase', 'column': 'column',
        },
        values: {
          m: 'message', message: 'message', F: 'file', file: 'file', sort: 'sort', format: 'format',
          'points-at': 'pointsAt', contains: 'contains', 'no-contains': 'noContains', merged: 'merged', 'no-merged': 'noMerged', u: 'localUser', 'local-user': 'localUser', cleanup: 'cleanup',
        },
      });
      if (parsed.unknown.length > 0) {
        return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);
      }
      if (parsed.has('verify')) {
        return createErrorResult('error: verifying tag signatures is not supported here', 1);
      }

      const positionals = parsed.rest;

      if (parsed.has('delete')) {
        return await this.deleteTags(positionals, cwd);
      }

      const listing = parsed.has('list') || lines !== undefined || positionals.length === 0 ||
        ['contains', 'noContains', 'merged', 'noMerged', 'pointsAt', 'sort', 'format'].some((n) => parsed.has(n));
      if (listing && !parsed.has('annotate') && !parsed.has('message') && !parsed.has('file') && !parsed.has('force')) {
        return await this.listTags(positionals, parsed, lines, cwd);
      }

      return await this.createTag(positionals, parsed, cwd);
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message, 128);
      return createErrorResult(`git tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async readTagInfo(name: string, cwd: string): Promise<TagInfo> {
    const oid = await this.git.resolveRef({ dir: cwd, ref: `refs/tags/${name}` });
    const obj = await this.git.readObject({ dir: cwd, oid, format: 'parsed' });
    if (obj.type === 'tag') {
      const tag = obj.object as { object: string; message: string; tagger: { timestamp: number } };
      let target = tag.object;
      try {
        target = await peel(this.git, cwd, oid, 'commit', name);
      } catch {
        // Tag of a tree or blob.
      }
      return { name, oid, target, annotated: true, message: tag.message, date: tag.tagger.timestamp };
    }
    if (obj.type === 'commit') {
      const commit = obj.object as { message: string; committer: { timestamp: number } };
      return { name, oid, target: oid, annotated: false, message: commit.message, date: commit.committer.timestamp };
    }
    return { name, oid, target: oid, annotated: false, message: '', date: 0 };
  }

  private async listTags(patterns: string[], parsed: ReturnType<typeof parseArgs>, lines: number | undefined, cwd: string): Promise<ShellCommandResult> {
    const ignoreCase = parsed.has('ignoreCase');
    const names = (await this.git.listTags({ dir: cwd })).filter((t) =>
      patterns.length === 0 || patterns.some((p) => ignoreCase ? matchesGlob(t.toLowerCase(), p.toLowerCase()) : matchesGlob(t, p)));

    let tags: TagInfo[] = [];
    for (const name of names) tags.push(await this.readTagInfo(name, cwd));

    const contains = parsed.get('contains');
    const noContains = parsed.get('noContains');
    const merged = parsed.get('merged');
    const noMerged = parsed.get('noMerged');
    const pointsAt = parsed.get('pointsAt');
    if (contains !== undefined) {
      const oid = await resolveCommit(this.git, cwd, contains);
      tags = await filterAsync(tags, (t) => isAncestor(this.git, cwd, oid, t.target));
    }
    if (noContains !== undefined) {
      const oid = await resolveCommit(this.git, cwd, noContains);
      tags = await filterAsync(tags, async (t) => !(await isAncestor(this.git, cwd, oid, t.target)));
    }
    if (merged !== undefined) {
      const oid = await resolveCommit(this.git, cwd, merged);
      tags = await filterAsync(tags, (t) => isAncestor(this.git, cwd, t.target, oid));
    }
    if (noMerged !== undefined) {
      const oid = await resolveCommit(this.git, cwd, noMerged);
      tags = await filterAsync(tags, async (t) => !(await isAncestor(this.git, cwd, t.target, oid)));
    }
    if (pointsAt !== undefined) {
      const oid = await resolveRevision(this.git, cwd, pointsAt);
      tags = tags.filter((t) => t.oid === oid || t.target === oid);
    }

    const sort = parsed.get('sort') ?? 'refname';
    const reverse = sort.startsWith('-');
    const key = sort.replace(/^-/, '');
    tags.sort((a, b) => {
      if (key === 'version:refname' || key === 'v:refname') return compareVersions(a.name, b.name);
      if (key === 'creatordate' || key === 'taggerdate' || key === 'committerdate') return a.date - b.date || cmp(a.name, b.name);
      return cmp(a.name, b.name);
    });
    if (reverse) tags.reverse();

    const format = parsed.get('format');
    let out = '';
    for (const tag of tags) {
      if (format !== undefined) {
        const [subject, ...body] = tag.message.split('\n');
        out += expandRefFormat(format, {
          refname: `refs/tags/${tag.name}`, short: tag.name, oid: tag.oid, subject,
          body: body.join('\n').replace(/^\n/, ''), objecttype: tag.annotated ? 'tag' : 'commit',
        }) + '\n';
      } else if (lines !== undefined) {
        const text = tag.message.replace(/\n+$/, '').split('\n').slice(0, Math.max(lines, 1));
        out += `${tag.name.padEnd(15)} ${text[0] ?? ''}`.trimEnd() + '\n';
        for (const line of text.slice(1)) out += `    ${line}\n`;
      } else {
        out += `${tag.name}\n`;
      }
    }
    return createSuccessResult(out);
  }

  private async createTag(positionals: string[], parsed: ReturnType<typeof parseArgs>, cwd: string): Promise<ShellCommandResult> {
    if (positionals.length === 0 || positionals.length > 2) {
      return createErrorResult(`usage: ${this.usage}`, 129);
    }
    const [name, target = 'HEAD'] = positionals;
    if (!isValidRefName(name)) {
      return createErrorResult(`fatal: '${name}' is not a valid tag name.`, 128);
    }

    let objectOid: string;
    try {
      objectOid = await resolveRevision(this.git, cwd, target);
    } catch {
      return createErrorResult(`fatal: Failed to resolve '${target}' as a valid ref.`, 128);
    }

    const existing = (await this.git.listTags({ dir: cwd })).includes(name)
      ? await this.git.resolveRef({ dir: cwd, ref: `refs/tags/${name}` })
      : undefined;
    if (existing && !parsed.has('force')) {
      return createErrorResult(`fatal: tag '${name}' already exists`, 128);
    }

    const parts = [...parsed.getAll('message')];
    for (const file of parsed.getAll('file')) {
      try {
        const path = file.startsWith('/') ? file : `${cwd}/${file}`;
        parts.push((await this.fs.readFile(path, 'utf8')).replace(/\n+$/, ''));
      } catch {
        return createErrorResult(`fatal: could not open or read '${file}': No such file or directory`, 128);
      }
    }
    const annotated = parsed.has('annotate') || parsed.has('sign') || parts.length > 0;

    let newOid = objectOid;
    if (annotated) {
      if (parts.length === 0) {
        return createErrorResult('error: no editor is available to write the tag message\nPlease supply the message using either -m or -F option.', 1);
      }
      const message = parts.join('\n\n').replace(/\n*$/, '\n');
      const { type } = await this.git.readObject({ dir: cwd, oid: objectOid, format: 'parsed' });
      newOid = await this.git.writeTag({
        dir: cwd,
        tag: { object: objectOid, type: type as 'commit', tag: name, tagger: await signature(this.git, this.fs, cwd), message },
      });
    }
    await this.git.writeRef({ dir: cwd, ref: `refs/tags/${name}`, value: newOid, force: true });

    if (existing && existing !== newOid) {
      return createSuccessResult(`Updated tag '${name}' (was ${abbrev(existing)})\n`);
    }
    return createSuccessResult('');
  }

  private async deleteTags(names: string[], cwd: string): Promise<ShellCommandResult> {
    if (names.length === 0) return createSuccessResult('');
    const tags = await this.git.listTags({ dir: cwd });
    let stdout = '';
    let stderr = '';
    for (const name of names) {
      if (!tags.includes(name)) {
        stderr += `error: tag '${name}' not found.\n`;
        continue;
      }
      const oid = await this.git.resolveRef({ dir: cwd, ref: `refs/tags/${name}` });
      await this.git.deleteRef({ dir: cwd, ref: `refs/tags/${name}` });
      stdout += `Deleted tag '${name}' (was ${abbrev(oid)})\n`;
    }
    return { exitCode: stderr ? 1 : 0, stdout, stderr };
  }
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function filterAsync<T>(items: T[], pred: (item: T) => Promise<boolean>): Promise<T[]> {
  const keep = await Promise.all(items.map(pred));
  return items.filter((_, i) => keep[i]);
}
