import { diffArrays } from "diff";
import type { ReadCommitResult } from "isomorphic-git";
import type { JSRuntimeFS } from "../../JSRuntime";
import type { ShellCommandResult } from "../ShellCommand";
import { createSuccessResult, createErrorResult } from "../ShellCommand";
import type { GitSubcommand, GitSubcommandOptions } from "../git";
import type { Git } from "../../git";
import { parseArgs, unknownOption } from "./args";
import { ZERO_OID } from "./diffing";
import { formatDateStyle, formatTimezone } from "./pretty";
import { lookupPath, resolveCommit, RevisionError } from "./revisions";

type Person = ReadCommitResult['commit']['author'];

/** Who a commit (or the working tree) says wrote a line. */
interface Origin {
  oid: string;
  author: Person;
  committer: Person;
  summary: string;
  boundary: boolean;
  previous?: string;
}

interface BlamedLine {
  origin: Origin;
  /** 1-based line number in the origin's version of the file. */
  line: number;
  text: string;
}

/** Lines still being traced, at one commit. */
interface Suspect {
  oid: string;
  blob: string;
  lines: string[];
  /** Final line index → line index in this commit's version. */
  entries: Array<[number, number]>;
}

const decoder = new TextDecoder();

export class GitBlameCommand implements GitSubcommand {
  name = 'blame';
  description = 'Show what revision and author last modified each line of a file';
  usage = 'git blame [-s] [-e] [-l] [-t] [-w] [--root] [--first-parent] [-L <range>] [--porcelain | --line-porcelain] [<rev>] [--] <file>';

  private git: Git;
  private fs: JSRuntimeFS;

  constructor(options: GitSubcommandOptions) {
    this.git = options.git;
    this.fs = options.fs;
  }

  async execute(args: string[], cwd: string): Promise<ShellCommandResult> {
    this.commits = new Map();
    try {
      try {
        await this.fs.stat(`${cwd}/.git`);
      } catch {
        return createErrorResult('fatal: not a git repository (or any of the parent directories): .git', 128);
      }

      const parsed = parseArgs(args, {
        flags: {
          s: 'noAuthor', e: 'email', 'show-email': 'email', l: 'long', t: 'rawTime', w: 'ignoreWhitespace',
          root: 'root', 'first-parent': 'firstParent', p: 'porcelain', porcelain: 'porcelain',
          'line-porcelain': 'linePorcelain', M: 'noop', C: 'noop', f: 'noop', 'show-name': 'noop',
        },
        values: { L: 'range' },
      });
      if (parsed.unknown.length > 0) return createErrorResult(unknownOption(parsed.unknown[0], this.usage), 129);

      let rev: string | undefined;
      let path: string | undefined;
      if (parsed.dashDash) {
        rev = parsed.positionals[0];
        path = parsed.paths[0];
      } else if (parsed.positionals.length >= 2) {
        [rev, path] = parsed.positionals;
      } else {
        path = parsed.positionals[0];
      }
      if (!path) return createErrorResult(`usage: ${this.usage}`, 129);
      path = path.replace(/^\.\//, '');

      let start: string;
      try {
        start = await resolveCommit(this.git, cwd, rev ?? 'HEAD');
      } catch (error) {
        if (rev === undefined) return createErrorResult('fatal: no such ref: HEAD', 128);
        throw error;
      }
      const startEntry = await this.readCommit(cwd, start);
      const entry = await lookupPath(this.git, cwd, startEntry.commit.tree, path);
      if (!entry || entry.type !== 'blob') {
        return createErrorResult(`fatal: no such path '${path}' in ${rev ?? 'HEAD'}`, 128);
      }
      const committedLines = splitLines(decoder.decode((await this.git.readBlob({ dir: cwd, oid: entry.oid })).blob));

      const sameLine = parsed.has('ignoreWhitespace')
        ? (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
        : (a: string, b: string) => a === b;

      // Without a revision, blame the working-tree version of the file.
      let finalLines = committedLines;
      const result: Array<BlamedLine | undefined> = [];
      let entries: Array<[number, number]> = committedLines.map((_, i) => [i, i]);
      if (rev === undefined) {
        let content: Uint8Array | undefined;
        try {
          content = await this.fs.readFile(`${cwd}/${path}`);
        } catch {
          // Deleted from the working tree; blame the committed version.
        }
        if (content) {
          finalLines = splitLines(decoder.decode(content));
          const map = mapLines(committedLines, finalLines, sameLine);
          entries = [];
          const now = Math.floor(Date.now() / 1000);
          const person: Person = { name: 'Not Committed Yet', email: 'not.committed.yet', timestamp: now, timezoneOffset: new Date().getTimezoneOffset() };
          const uncommitted: Origin = {
            oid: ZERO_OID, author: person, committer: person, boundary: false,
            summary: `Version of ${path} from ${path}`, previous: `${start} ${path}`,
          };
          finalLines.forEach((text, i) => {
            const old = map.get(i);
            if (old === undefined) result[i] = { origin: uncommitted, line: i + 1, text };
            else entries.push([i, old]);
          });
        }
      }

      await this.trace(cwd, path, { oid: start, blob: entry.oid, lines: committedLines, entries }, finalLines, result, {
        firstParent: parsed.has('firstParent'),
        root: parsed.has('root'),
        sameLine,
      });

      // Line ranges.
      let selected = finalLines.map((_, i) => i);
      const ranges = parsed.getAll('range');
      if (ranges.length > 0) {
        const keep = new Set<number>();
        for (const spec of ranges) {
          const range = parseRange(spec, finalLines.length);
          if (typeof range === 'string') return createErrorResult(range.replace('%s', path), 128);
          for (let i = range[0]; i <= range[1]; i++) keep.add(i - 1);
        }
        selected = [...keep].sort((a, b) => a - b);
      }

      const lines = selected.map((i) => ({ final: i + 1, blamed: result[i]! }));
      if (parsed.has('porcelain') || parsed.has('linePorcelain')) {
        return createSuccessResult(porcelain(lines, path, parsed.has('linePorcelain')));
      }

      const hashLength = parsed.has('long') ? 40 : 8;
      const who = (origin: Origin) => (parsed.has('email') ? `<${origin.author.email}>` : origin.author.name);
      const nameWidth = Math.max(0, ...lines.map(({ blamed }) => who(blamed.origin).length));
      const numberWidth = String(Math.max(0, ...lines.map(({ final }) => final))).length;
      const out = lines.map(({ final, blamed }) => {
        const { origin } = blamed;
        const hash = origin.boundary ? `^${origin.oid.slice(0, hashLength - 1)}` : origin.oid.slice(0, hashLength);
        const number = String(final).padStart(numberWidth);
        if (parsed.has('noAuthor')) return `${hash} ${number}) ${blamed.text}`;
        const date = parsed.has('rawTime')
          ? `${origin.author.timestamp} ${formatTimezone(origin.author.timezoneOffset)}`
          : formatDateStyle(origin.author, 'iso');
        return `${hash} (${who(origin).padEnd(nameWidth)} ${date} ${number}) ${blamed.text}`;
      });
      return createSuccessResult(out.length > 0 ? `${out.join('\n')}\n` : '');
    } catch (error) {
      if (error instanceof RevisionError) return createErrorResult(error.message, 128);
      return createErrorResult(`git blame: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private commits = new Map<string, ReadCommitResult>();

  private async readCommit(dir: string, oid: string): Promise<ReadCommitResult> {
    let entry = this.commits.get(oid);
    if (!entry) {
      entry = await this.git.readCommit({ dir, oid });
      this.commits.set(oid, entry);
    }
    return entry;
  }

  /** Pass lines back through history until the commit that introduced each is found. */
  private async trace(
    dir: string,
    path: string,
    first: Suspect,
    finalLines: string[],
    result: Array<BlamedLine | undefined>,
    options: { firstParent: boolean; root: boolean; sameLine: (a: string, b: string) => boolean },
  ): Promise<void> {
    const pending = new Map<string, Suspect>([[first.oid, first]]);
    const blobLines = new Map<string, string[]>();

    while (pending.size > 0) {
      // Newest commit first, so lines reach a merge's parents before those parents are examined.
      let suspect: Suspect | undefined;
      let newest = -Infinity;
      for (const candidate of pending.values()) {
        const time = (await this.readCommit(dir, candidate.oid)).commit.committer.timestamp;
        if (time > newest) {
          newest = time;
          suspect = candidate;
        }
      }
      pending.delete(suspect!.oid);
      const { commit } = await this.readCommit(dir, suspect!.oid);
      let remaining = suspect!.entries;
      let previous: string | undefined;

      for (const parent of options.firstParent ? commit.parent.slice(0, 1) : commit.parent) {
        if (remaining.length === 0) break;
        const parentCommit = await this.readCommit(dir, parent);
        const parentEntry = await lookupPath(this.git, dir, parentCommit.commit.tree, path);
        if (!parentEntry || parentEntry.type !== 'blob') continue;
        previous ??= `${parent} ${path}`;

        let passed: Array<[number, number]>;
        let parentLines = blobLines.get(parentEntry.oid);
        if (parentEntry.oid === suspect!.blob) {
          passed = remaining;
          remaining = [];
          parentLines ??= suspect!.lines;
        } else {
          parentLines ??= splitLines(decoder.decode((await this.git.readBlob({ dir, oid: parentEntry.oid })).blob));
          const map = mapLines(parentLines, suspect!.lines, options.sameLine);
          passed = [];
          const kept: Array<[number, number]> = [];
          for (const [final, line] of remaining) {
            const old = map.get(line);
            if (old === undefined) kept.push([final, line]);
            else passed.push([final, old]);
          }
          remaining = kept;
        }
        blobLines.set(parentEntry.oid, parentLines);

        if (passed.length > 0) {
          const existing = pending.get(parent);
          if (existing) existing.entries.push(...passed);
          else pending.set(parent, { oid: parent, blob: parentEntry.oid, lines: parentLines, entries: passed });
        }
      }

      if (remaining.length > 0) {
        const origin: Origin = {
          oid: suspect!.oid,
          author: commit.author,
          committer: commit.committer,
          summary: commit.message.split('\n')[0],
          boundary: commit.parent.length === 0 && !options.root,
          previous,
        };
        for (const [final, line] of remaining) {
          result[final] = { origin, line: line + 1, text: finalLines[final] };
        }
      }
    }
  }
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** For each line of `newer` that is unchanged from `older`, its index in `older`. */
function mapLines(older: string[], newer: string[], sameLine: (a: string, b: string) => boolean): Map<number, number> {
  const map = new Map<number, number>();
  let o = 0;
  let n = 0;
  for (const part of diffArrays(older, newer, { comparator: sameLine })) {
    const count = part.value.length;
    if (part.added) {
      n += count;
    } else if (part.removed) {
      o += count;
    } else {
      for (let i = 0; i < count; i++) map.set(n + i, o + i);
      o += count;
      n += count;
    }
  }
  return map;
}

/** Parse `-L <start>,<end>` (also `<start>,+<n>`, `<start>,-<n>`, `<start>`, `,<end>`) into 1-based bounds. */
function parseRange(spec: string, total: number): [number, number] | string {
  const match = spec.match(/^(\d*)(?:,([+-]?\d*))?$/);
  if (!match) return `fatal: -L parameter '${spec}' is not supported; use line numbers`;
  let start = match[1] ? parseInt(match[1], 10) : 1;
  const endSpec = match[2] ?? '';
  let end: number;
  if (endSpec.startsWith('+')) end = start + parseInt(endSpec.slice(1) || '0', 10) - 1;
  else if (endSpec.startsWith('-')) {
    end = start;
    start = Math.max(1, start - parseInt(endSpec.slice(1) || '0', 10) + 1);
  } else end = endSpec ? parseInt(endSpec, 10) : total;
  if (start < 1) start = 1;
  if (end < start) [start, end] = [end, start];
  if (start > total) return `fatal: file %s has only ${total} line${total === 1 ? '' : 's'}`;
  return [start, Math.min(end, total)];
}

function porcelain(lines: Array<{ final: number; blamed: BlamedLine }>, path: string, everyLine: boolean): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const { final, blamed } = lines[i];
    const { origin } = blamed;
    const prev = lines[i - 1];
    const continues = prev && prev.blamed.origin === origin && prev.final === final - 1 && prev.blamed.line === blamed.line - 1;
    let size = 1;
    if (!continues) {
      while (i + size < lines.length) {
        const next = lines[i + size];
        if (next.blamed.origin !== origin || next.final !== final + size || next.blamed.line !== blamed.line + size) break;
        size++;
      }
    }
    out.push(continues ? `${origin.oid} ${blamed.line} ${final}` : `${origin.oid} ${blamed.line} ${final} ${size}`);
    if (everyLine || !seen.has(origin.oid)) {
      seen.add(origin.oid);
      out.push(
        `author ${origin.author.name}`,
        `author-mail <${origin.author.email}>`,
        `author-time ${origin.author.timestamp}`,
        `author-tz ${formatTimezone(origin.author.timezoneOffset)}`,
        `committer ${origin.committer.name}`,
        `committer-mail <${origin.committer.email}>`,
        `committer-time ${origin.committer.timestamp}`,
        `committer-tz ${formatTimezone(origin.committer.timezoneOffset)}`,
        `summary ${origin.summary}`,
      );
      if (origin.boundary) out.push('boundary');
      if (origin.previous) out.push(`previous ${origin.previous}`);
      out.push(`filename ${path}`);
    }
    out.push(`\t${blamed.text}`);
  }
  return out.length > 0 ? `${out.join('\n')}\n` : '';
}
